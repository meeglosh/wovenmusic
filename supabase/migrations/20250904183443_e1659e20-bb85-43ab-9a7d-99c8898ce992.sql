-- Fix infinite recursion in RLS policies
-- Drop problematic policies that reference their own tables

-- Drop all problematic track policies
DROP POLICY IF EXISTS "tracks acl read" ON tracks;
DROP POLICY IF EXISTS "tracks insert sets owner" ON tracks;
DROP POLICY IF EXISTS "tracks owner delete" ON tracks;
DROP POLICY IF EXISTS "tracks owner read" ON tracks;
DROP POLICY IF EXISTS "tracks owner update" ON tracks;
DROP POLICY IF EXISTS "tracks public read" ON tracks;

-- Drop problematic playlist_acl policies
DROP POLICY IF EXISTS "playlist_owners_can_manage_acl" ON playlist_acl;
DROP POLICY IF EXISTS "users_can_view_their_playlist_permissions" ON playlist_acl;

-- Drop problematic track_acl policies
DROP POLICY IF EXISTS "track_owners_can_manage_acl" ON track_acl;
DROP POLICY IF EXISTS "users_can_view_their_track_permissions" ON track_acl;

-- Drop problematic playlist policies that might cause recursion
DROP POLICY IF EXISTS "playlists acl read" ON playlists;
DROP POLICY IF EXISTS "playlists owner read" ON playlists;
DROP POLICY IF EXISTS "playlists public read" ON playlists;
DROP POLICY IF EXISTS "playlist_tracks readable via playlist" ON playlist_tracks;

-- Create simple, safe policies that don't cause recursion

-- For tracks: Keep existing working policies, add missing safe ones
CREATE POLICY "tracks_owner_access" ON tracks
FOR ALL USING (created_by = auth.uid());

CREATE POLICY "tracks_public_access" ON tracks
FOR SELECT USING (is_public = true);

CREATE POLICY "tracks_band_member_access" ON tracks
FOR SELECT USING (
  is_band_member_safe(auth.uid()) = true 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = tracks.created_by 
    AND is_band_member = true
  )
);

-- For playlists: Simple access control
CREATE POLICY "playlists_owner_access" ON playlists
FOR ALL USING (created_by = auth.uid());

CREATE POLICY "playlists_public_access" ON playlists
FOR SELECT USING (is_public = true);

-- For playlist_tracks: Safe access via playlist ownership
CREATE POLICY "playlist_tracks_via_playlist_owner" ON playlist_tracks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND playlists.created_by = auth.uid()
  )
);

CREATE POLICY "playlist_tracks_via_public_playlist" ON playlist_tracks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_tracks.playlist_id 
    AND playlists.is_public = true
  )
);

-- For ACL tables: Simple owner-based access
CREATE POLICY "track_acl_owner_access" ON track_acl
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tracks 
    WHERE tracks.id = track_acl.track_id 
    AND tracks.created_by = auth.uid()
  )
);

CREATE POLICY "track_acl_user_view" ON track_acl
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "playlist_acl_owner_access" ON playlist_acl
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM playlists 
    WHERE playlists.id = playlist_acl.playlist_id 
    AND playlists.created_by = auth.uid()
  )
);

CREATE POLICY "playlist_acl_user_view" ON playlist_acl
FOR SELECT USING (user_id = auth.uid());