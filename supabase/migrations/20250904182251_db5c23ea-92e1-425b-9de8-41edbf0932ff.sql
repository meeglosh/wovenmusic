-- Fix security warnings: Add RLS policies for ACL tables

-- Add RLS policies for track_acl table
CREATE POLICY "track_owners_can_manage_acl" 
  ON public.track_acl 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.tracks 
      WHERE tracks.id = track_acl.track_id 
      AND (tracks.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
    )
  );

CREATE POLICY "users_can_view_their_track_permissions" 
  ON public.track_acl 
  FOR SELECT 
  USING (user_id = auth.uid());

-- Add RLS policies for playlist_acl table  
CREATE POLICY "playlist_owners_can_manage_acl" 
  ON public.playlist_acl 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_acl.playlist_id 
      AND (playlists.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
    )
  );

CREATE POLICY "users_can_view_their_playlist_permissions" 
  ON public.playlist_acl 
  FOR SELECT 
  USING (user_id = auth.uid());