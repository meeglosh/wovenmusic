-- Fix Early Access Email Exposure - Remove public SELECT policy
DROP POLICY IF EXISTS "Anyone can view early access emails" ON public.early_access_emails;

-- Fix Database Functions Security - Add proper search path to existing functions
CREATE OR REPLACE FUNCTION public.is_band_member_safe(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_band_member FROM public.profiles WHERE id = user_id),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_safe(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = user_id),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_any_band_members()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE is_band_member = true);
$function$;

-- Add constraint to prevent users from modifying their own admin/band_member status
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger AS $$
BEGIN
  -- Allow admins to modify any profile
  IF public.is_admin_safe(auth.uid()) THEN
    RETURN NEW;
  END IF;
  
  -- Prevent non-admins from modifying admin/band_member status
  IF OLD.is_admin != NEW.is_admin OR OLD.is_band_member != NEW.is_band_member THEN
    RAISE EXCEPTION 'Insufficient privileges to modify admin or band member status';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Add trigger to prevent privilege escalation
DROP TRIGGER IF EXISTS prevent_privilege_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_privilege_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_admin IS DISTINCT FROM NEW.is_admin OR OLD.is_band_member IS DISTINCT FROM NEW.is_band_member)
  EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Add logging for security events
CREATE OR REPLACE FUNCTION public.log_email_submission()
RETURNS trigger AS $$
BEGIN
  -- Log email submissions for monitoring
  PERFORM public.log_security_event(
    'early_access_email_submission',
    jsonb_build_object(
      'email', NEW.email,
      'timestamp', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Add trigger for email submission logging
DROP TRIGGER IF EXISTS log_email_submission_trigger ON public.early_access_emails;
CREATE TRIGGER log_email_submission_trigger
  AFTER INSERT ON public.early_access_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.log_email_submission();