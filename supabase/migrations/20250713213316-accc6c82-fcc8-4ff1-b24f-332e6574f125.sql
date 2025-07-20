-- Fix critical security issue: strengthen RLS policies for band_members and playlist_tracks tables

-- Drop the problematic "Allow all operations" policy on band_members
DROP POLICY IF EXISTS "Allow all operations on band_members" ON public.band_members;

-- Create restrictive policies for band_members table
CREATE POLICY "Band members can view other band member records" 
ON public.band_members 
FOR SELECT 
USING (is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Band members can create band member records" 
ON public.band_members 
FOR INSERT 
WITH CHECK (is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Band members can update band member records" 
ON public.band_members 
FOR UPDATE 
USING (is_band_member_safe(auth.uid()) = true)
WITH CHECK (is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Band members can delete band member records" 
ON public.band_members 
FOR DELETE 
USING (is_band_member_safe(auth.uid()) = true);

-- Drop the problematic "Allow all operations" policy on playlist_tracks
DROP POLICY IF EXISTS "Allow all operations on playlist_tracks" ON public.playlist_tracks;

-- Create restrictive policies for playlist_tracks table
CREATE POLICY "Users can view tracks in their playlists" 
ON public.playlist_tracks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND (playlists.created_by = auth.uid() OR playlists.is_public = true)
  )
);

CREATE POLICY "Users can add tracks to their playlists" 
ON public.playlist_tracks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND playlists.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update tracks in their playlists" 
ON public.playlist_tracks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND playlists.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND playlists.created_by = auth.uid()
  )
);

CREATE POLICY "Users can remove tracks from their playlists" 
ON public.playlist_tracks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND playlists.created_by = auth.uid()
  )
);