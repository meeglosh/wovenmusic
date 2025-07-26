-- Fix the security warning by setting search_path
CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
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
$$;

-- Create trigger to run before profile creation
CREATE OR REPLACE TRIGGER set_first_user_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_admin();