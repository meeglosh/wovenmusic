-- Add admin functionality to profiles
-- Add an is_admin column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin_safe(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = user_id),
    false
  );
$function$;

-- Add DELETE policy for admins to delete any profile
CREATE POLICY "Admins can delete any profile" 
ON public.profiles 
FOR DELETE 
USING (is_admin_safe(auth.uid()) = true);

-- Add UPDATE policy for admins to update any profile
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (is_admin_safe(auth.uid()) = true);

-- Add SELECT policy for admins to view any profile
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_admin_safe(auth.uid()) = true);