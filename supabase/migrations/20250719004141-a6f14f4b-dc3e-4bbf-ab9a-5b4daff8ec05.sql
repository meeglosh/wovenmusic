-- Create security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_details JSONB NOT NULL DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for security audit log
CREATE POLICY "Admins can view all security audit logs"
  ON public.security_audit_log
  FOR SELECT
  USING (is_admin_safe(auth.uid()) = true);

-- Enhanced security event logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_event_details JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Secure privilege update function with embedded validation and logging
CREATE OR REPLACE FUNCTION public.update_user_privileges(
  p_target_user_id UUID,
  p_is_admin BOOLEAN DEFAULT NULL,
  p_is_band_member BOOLEAN DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    PERFORM log_security_event(
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
    PERFORM log_security_event(
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
    PERFORM log_security_event(
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
      PERFORM log_security_event(
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
  PERFORM log_security_event(
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
$$;