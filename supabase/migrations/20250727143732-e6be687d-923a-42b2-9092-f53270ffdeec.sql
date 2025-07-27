-- Allow public read access to invitations for validation purposes
-- This is needed so unauthenticated users can validate invitation tokens
CREATE POLICY "Public can view invitations for validation" 
ON public.invitations 
FOR SELECT 
USING (true);