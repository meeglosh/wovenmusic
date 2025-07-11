-- Completely fix the infinite recursion issue
-- Drop the problematic policy and function
DROP POLICY IF EXISTS "Users can view public playlists or playlists shared with them" ON public.playlists;
DROP FUNCTION IF EXISTS public.get_current_user_email();

-- Create a much simpler policy that works without recursion
CREATE POLICY "Users can view playlists" 
ON public.playlists 
FOR SELECT 
USING (
  is_public = true 
  OR created_by = auth.uid()
);