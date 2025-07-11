-- Fix infinite recursion in playlists RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view public playlists or playlists shared with them" ON public.playlists;

-- Create a security definer function to get user email without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Recreate the policy using the security definer function
CREATE POLICY "Users can view public playlists or playlists shared with them" 
ON public.playlists 
FOR SELECT 
USING (
  is_public = true 
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.playlist_shares ps
    WHERE ps.playlist_id = playlists.id AND ps.email = public.get_current_user_email()
  )
);