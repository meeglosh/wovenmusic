-- Tighten visibility of invitation records to prevent token/email exposure
-- Ensure RLS is enabled
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Remove broad read access
DROP POLICY IF EXISTS "Band members can view invitations" ON public.invitations;

-- Allow only admins or the user who created the invite to view it
CREATE POLICY "Admins or inviters can view invitations"
ON public.invitations
FOR SELECT
USING (
  is_admin_safe(auth.uid()) = true
  OR invited_by = auth.uid()
);
