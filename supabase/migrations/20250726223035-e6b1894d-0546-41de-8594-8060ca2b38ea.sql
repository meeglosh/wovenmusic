-- Drop existing policy
DROP POLICY IF EXISTS "Users can view playlists" ON public.playlists;

-- Create updated policy for current single-band structure
CREATE POLICY "Users can view playlists"
ON public.playlists
FOR SELECT
USING (
  -- Public playlists are viewable by anyone
  is_public = true
  
  -- Creator can view their own playlists
  OR created_by = auth.uid()
  
  -- Band members can view playlists created by other band members
  OR (
    is_band_member_safe(auth.uid()) = true 
    AND EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE profiles.id = playlists.created_by 
      AND profiles.is_band_member = true
    )
  )
);