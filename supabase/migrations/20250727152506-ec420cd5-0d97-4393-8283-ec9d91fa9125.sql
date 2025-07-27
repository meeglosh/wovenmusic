-- Add profile_completed flag to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- Set profile_completed = true for existing users who already have complete profiles
UPDATE public.profiles 
SET profile_completed = true 
WHERE full_name IS NOT NULL 
  AND role IS NOT NULL 
  AND full_name != '' 
  AND role != '';

-- Update the handle_new_user function to set profile_completed to false for all new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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
$$;