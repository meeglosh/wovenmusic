-- Fix critical security issues identified in security review

-- 1. CRITICAL: Fix playlist RLS policy to exclude share_token from public SELECT
DROP POLICY IF EXISTS "Users can view playlists" ON public.playlists;

CREATE POLICY "Users can view playlists" 
ON public.playlists 
FOR SELECT 
USING (
  (is_public = true) OR 
  (created_by = auth.uid()) OR 
  ((is_band_member_safe(auth.uid()) = true) AND (EXISTS ( 
    SELECT 1
    FROM profiles
    WHERE ((profiles.id = playlists.created_by) AND (profiles.is_band_member = true))
  )))
);

-- 2. Create a separate policy for share token access
CREATE POLICY "Public access via share token" 
ON public.playlists 
FOR SELECT 
USING (
  share_token IS NOT NULL AND 
  is_public = true
);

-- 3. MEDIUM: Fix database function security by adding proper search_path
CREATE OR REPLACE FUNCTION public.is_band_member_safe(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT is_band_member FROM public.profiles WHERE id = user_id),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_any_band_members()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE is_band_member = true);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_safe(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = user_id),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
 SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

-- 4. HIGH: Strengthen invitation RLS policies
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;

CREATE POLICY "Band members can create invitations with rate limiting" 
ON public.invitations 
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  ((is_band_member_safe(auth.uid()) = true) OR (NOT has_any_band_members())) AND
  -- Basic rate limiting: max 10 invitations per user per day
  (
    SELECT COUNT(*) 
    FROM public.invitations 
    WHERE invited_by = auth.uid() 
    AND created_at > NOW() - INTERVAL '1 day'
  ) < 10
);