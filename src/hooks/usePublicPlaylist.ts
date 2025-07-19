import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePublicPlaylist = (playlistId: string) => {
  return useQuery({
    queryKey: ["publicPlaylist", playlistId],
    queryFn: async () => {
      // Fetch public playlist without authentication
      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .select(`
          *,
          playlist_tracks (
            track_id,
            position,
            tracks (
              id,
              title,
              artist,
              duration,
              file_url,
              is_public,
              created_by
            )
          )
        `)
        .eq("id", playlistId)
        .eq("is_public", true)
        .single();
      
      if (playlistError) throw playlistError;
      if (!playlist) throw new Error("Playlist not found or not public");
      
      // Only return public tracks
      const publicTracks = playlist.playlist_tracks
        .filter(pt => pt.tracks && pt.tracks.is_public)
        .sort((a, b) => a.position - b.position)
        .map(pt => ({
          id: pt.tracks.id,
          title: pt.tracks.title,
          artist: pt.tracks.artist,
          duration: pt.tracks.duration,
          fileUrl: pt.tracks.file_url,
          addedAt: new Date(), // We don't have this data in this context
          is_public: pt.tracks.is_public,
          created_by: pt.tracks.created_by
        }));
      
      return {
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlist.image_url,
        tracks: publicTracks,
        isPublic: playlist.is_public,
        shareToken: playlist.share_token,
        createdAt: new Date(playlist.created_at)
      };
    },
    enabled: !!playlistId
  });
};

export const usePublicPlaylistByToken = (shareToken: string) => {
  return useQuery({
    queryKey: ["publicPlaylistByToken", shareToken],
    queryFn: async () => {
      // Fetch playlist by share token without authentication
      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .select(`
          *,
          playlist_tracks (
            track_id,
            position,
            tracks (
              id,
              title,
              artist,
              duration,
              file_url,
              is_public,
              created_by
            )
          )
        `)
        .eq("share_token", shareToken)
        .eq("is_public", true)
        .single();
      
      if (playlistError) throw playlistError;
      if (!playlist) throw new Error("Playlist not found or not public");
      
      // Only return public tracks
      const publicTracks = playlist.playlist_tracks
        .filter(pt => pt.tracks && pt.tracks.is_public)
        .sort((a, b) => a.position - b.position)
        .map(pt => ({
          id: pt.tracks.id,
          title: pt.tracks.title,
          artist: pt.tracks.artist,
          duration: pt.tracks.duration,
          fileUrl: pt.tracks.file_url,
          addedAt: new Date(), // We don't have this data in this context
          is_public: pt.tracks.is_public,
          created_by: pt.tracks.created_by
        }));
      
      return {
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlist.image_url,
        tracks: publicTracks,
        isPublic: playlist.is_public,
        shareToken: playlist.share_token,
        createdAt: new Date(playlist.created_at)
      };
    },
    enabled: !!shareToken
  });
};