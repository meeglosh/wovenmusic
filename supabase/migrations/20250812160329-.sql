-- Remove overly permissive public SELECT policy on invitations table
DROP POLICY IF EXISTS "Public can view invitations for validation" ON public.invitations;

-- No further changes needed; band members can still view invitations via existing policy
-- This migration reduces public data exposure without breaking admin/member functionality.