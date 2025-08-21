-- Fix remaining functions with missing search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Count existing admins
  SELECT COUNT(*) INTO admin_count FROM public.profiles WHERE is_admin = true;
  
  -- If no admins exist, make this user an admin
  IF admin_count = 0 THEN
    NEW.is_admin = true;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_security_event(p_event_type text, p_event_details jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.security_audit_log (
    event_type,
    event_details,
    user_id,
    ip_address,
    user_agent
  ) VALUES (
    p_event_type,
    p_event_details,
    COALESCE(p_user_id, auth.uid()),
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_privileges(p_target_user_id uuid, p_is_admin boolean DEFAULT NULL::boolean, p_is_band_member boolean DEFAULT NULL::boolean, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  target_profile RECORD;
  current_profile RECORD;
  admin_count INTEGER;
  log_details JSONB := '{}';
  result JSONB := '{"success": false}';
BEGIN
  -- Validate current user is authenticated
  IF current_user_id IS NULL THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
    PERFORM public.log_security_event(
      'privilege_update_failed',
      jsonb_build_object(
        'error', 'Not authenticated',
        'target_user_id', p_target_user_id
      ),
      current_user_id,
      p_ip_address,
      p_user_agent
    );
    RETURN result;
  END IF;

  -- Get current user profile
  SELECT * INTO current_profile FROM public.profiles WHERE id = current_user_id;
  
  -- Validate current user is admin
  IF NOT COALESCE(current_profile.is_admin, false) THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Insufficient privileges'
    );
    PERFORM public.log_security_event(
      'privilege_update_failed',
      jsonb_build_object(
        'error', 'Insufficient privileges',
        'target_user_id', p_target_user_id,
        'current_user_admin', COALESCE(current_profile.is_admin, false)
      ),
      current_user_id,
      p_ip_address,
      p_user_agent
    );
    RETURN result;
  END IF;

  -- Get target user profile
  SELECT * INTO target_profile FROM public.profiles WHERE id = p_target_user_id;
  
  IF target_profile IS NULL THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Target user not found'
    );
    PERFORM public.log_security_event(
      'privilege_update_failed',
      jsonb_build_object(
        'error', 'Target user not found',
        'target_user_id', p_target_user_id
      ),
      current_user_id,
      p_ip_address,
      p_user_agent
    );
    RETURN result;
  END IF;

  -- Build log details
  log_details := jsonb_build_object(
    'target_user_id', p_target_user_id,
    'target_user_email', target_profile.email,
    'current_privileges', jsonb_build_object(
      'is_admin', COALESCE(target_profile.is_admin, false),
      'is_band_member', COALESCE(target_profile.is_band_member, false)
    )
  );

  -- Self-demotion protection
  IF p_target_user_id = current_user_id AND p_is_admin = false THEN
    -- Count current admins
    SELECT COUNT(*) INTO admin_count 
    FROM public.profiles 
    WHERE COALESCE(is_admin, false) = true;
    
    IF admin_count <= 1 THEN
      result := jsonb_build_object(
        'success', false,
        'error', 'Cannot remove admin privileges from the last admin'
      );
      PERFORM public.log_security_event(
        'privilege_update_failed',
        log_details || jsonb_build_object(
          'error', 'Last admin protection',
          'admin_count', admin_count
        ),
        current_user_id,
        p_ip_address,
        p_user_agent
      );
      RETURN result;
    END IF;
  END IF;

  -- Update privileges
  UPDATE public.profiles 
  SET 
    is_admin = COALESCE(p_is_admin, is_admin),
    is_band_member = COALESCE(p_is_band_member, is_band_member),
    updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Add new privileges to log
  log_details := log_details || jsonb_build_object(
    'new_privileges', jsonb_build_object(
      'is_admin', COALESCE(p_is_admin, target_profile.is_admin),
      'is_band_member', COALESCE(p_is_band_member, target_profile.is_band_member)
    )
  );

  -- Log successful update
  PERFORM public.log_security_event(
    'privilege_update_success',
    log_details,
    current_user_id,
    p_ip_address,
    p_user_agent
  );

  result := jsonb_build_object(
    'success', true,
    'message', 'Privileges updated successfully'
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_playlist_ownership_to_admin(deleted_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_admin_id UUID;
BEGIN
  -- Find the best admin to transfer ownership to
  -- Priority: earliest created admin who is still a band member
  SELECT id INTO target_admin_id
  FROM public.profiles 
  WHERE is_admin = true 
    AND is_band_member = true 
    AND id != deleted_user_id
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no admin found, return null (shouldn't happen in normal scenarios)
  IF target_admin_id IS NULL THEN
    -- Log this as it's an unusual situation
    PERFORM public.log_security_event(
      'playlist_transfer_no_admin_found',
      jsonb_build_object(
        'deleted_user_id', deleted_user_id,
        'message', 'No admin found to transfer playlists to'
      )
    );
    RETURN NULL;
  END IF;
  
  -- Transfer ownership of all playlists from deleted user to the admin
  UPDATE public.playlists 
  SET 
    created_by = target_admin_id,
    updated_at = NOW()
  WHERE created_by = deleted_user_id;
  
  -- Log the transfer for audit purposes
  PERFORM public.log_security_event(
    'playlist_ownership_transferred',
    jsonb_build_object(
      'deleted_user_id', deleted_user_id,
      'new_owner_id', target_admin_id,
      'transferred_count', (
        SELECT COUNT(*) 
        FROM public.playlists 
        WHERE created_by = target_admin_id 
          AND updated_at = NOW()
      )
    )
  );
  
  RETURN target_admin_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  playlist_count INTEGER;
BEGIN
  -- Count playlists owned by the user being deleted
  SELECT COUNT(*) INTO playlist_count
  FROM public.playlists 
  WHERE created_by = OLD.id;
  
  -- Return early if no playlists owned (performance optimization)
  IF playlist_count = 0 THEN
    RETURN OLD;
  END IF;
  
  -- Transfer playlists to an admin
  PERFORM public.transfer_playlist_ownership_to_admin(OLD.id);
  
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, profile_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'invitation_role', 'Member'),
    false
  );
  RETURN NEW;
END;
$function$;