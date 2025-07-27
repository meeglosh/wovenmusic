-- Update RLS policies to allow admins full access to playlist management
-- This enables admins to edit, delete, and manage tracks for any playlist

-- Update playlist policies to allow admin access
DROP POLICY IF EXISTS "Users can update their own playlists" ON public.playlists;
CREATE POLICY "Users can update their own playlists OR admins can update any playlist" 
ON public.playlists 
FOR UPDATE 
USING (created_by = auth.uid() OR is_admin_safe(auth.uid()) = true);

DROP POLICY IF EXISTS "Users can delete their own playlists" ON public.playlists;
CREATE POLICY "Users can delete their own playlists OR admins can delete any playlist" 
ON public.playlists 
FOR DELETE 
USING (created_by = auth.uid() OR is_admin_safe(auth.uid()) = true);

-- Update playlist_tracks policies to allow admin access
DROP POLICY IF EXISTS "Users can add tracks to their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can add tracks to their playlists OR admins can add tracks to any playlist" 
ON public.playlist_tracks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

DROP POLICY IF EXISTS "Users can remove tracks from their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can remove tracks from their playlists OR admins can remove tracks from any playlist" 
ON public.playlist_tracks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

DROP POLICY IF EXISTS "Users can update tracks in their playlists" ON public.playlist_tracks;
CREATE POLICY "Users can update tracks in their playlists OR admins can update tracks in any playlist" 
ON public.playlist_tracks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

-- Update playlist_shares policies to allow admin access
DROP POLICY IF EXISTS "Users can create shares for playlists they created" ON public.playlist_shares;
CREATE POLICY "Users can create shares for playlists they created OR admins can create shares for any playlist" 
ON public.playlist_shares 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_shares.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

DROP POLICY IF EXISTS "Users can delete shares for playlists they created" ON public.playlist_shares;
CREATE POLICY "Users can delete shares for playlists they created OR admins can delete shares for any playlist" 
ON public.playlist_shares 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_shares.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

DROP POLICY IF EXISTS "Users can view shares for playlists they created" ON public.playlist_shares;
CREATE POLICY "Users can view shares for playlists they created OR admins can view shares for any playlist" 
ON public.playlist_shares 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_shares.playlist_id 
    AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);