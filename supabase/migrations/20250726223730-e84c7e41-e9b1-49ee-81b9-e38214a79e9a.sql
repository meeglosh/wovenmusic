-- Drop existing SELECT policy on playlist_tracks
DROP POLICY IF EXISTS "Users can view tracks in their playlists" ON public.playlist_tracks;

-- Create updated policy to mirror playlists policy logic
CREATE POLICY "Users can view tracks in their playlists"
ON public.playlist_tracks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM playlists
    WHERE playlists.id = playlist_tracks.playlist_id
    AND (
      -- Public playlists are viewable by anyone
      playlists.is_public = true
      
      -- Creator can view their own playlists
      OR playlists.created_by = auth.uid()
      
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
    )
  )
);