-- Update RLS policy for custom_roles to only show roles to their creators
DROP POLICY IF EXISTS "Band members can view custom roles" ON public.custom_roles;

CREATE POLICY "Users can view custom roles they created"
ON public.custom_roles
FOR SELECT
USING (auth.uid() = created_by);