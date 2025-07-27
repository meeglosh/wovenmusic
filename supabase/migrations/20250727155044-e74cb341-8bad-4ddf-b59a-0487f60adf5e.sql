-- Update RLS policy for custom_roles to allow any authenticated user to create roles for themselves
-- Remove the band_member requirement that was blocking new users during onboarding

DROP POLICY IF EXISTS "Band members can create custom roles" ON public.custom_roles;

CREATE POLICY "Authenticated users can create custom roles" 
ON public.custom_roles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- Also update the other policies to be consistent with the new approach
DROP POLICY IF EXISTS "Band members can delete custom roles they created" ON public.custom_roles;
DROP POLICY IF EXISTS "Band members can update custom roles they created" ON public.custom_roles;

CREATE POLICY "Users can delete custom roles they created" 
ON public.custom_roles 
FOR DELETE 
TO authenticated 
USING (auth.uid() = created_by);

CREATE POLICY "Users can update custom roles they created" 
ON public.custom_roles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = created_by);