import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

// Create a separate Supabase client without RLS for public access
const publicSupabase = createClient(
  "https://woakvdhlpludrttjixxq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYWt2ZGhscGx1ZHJ0dGppeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMjMwODEsImV4cCI6MjA2NjY5OTA4MX0.TklesWo8b-lZW2SsE39icrcC0Y8ho5xzGUdj9MZg-Xg",
  {
    auth: {
      persistSession: false // Don't persist auth for public access
    }
  }
);

export const usePublicPlaylist = (playlistId: string) => {
  return useQuery({
    queryKey: ["publicPlaylist", playlistId],
    queryFn: async () => {
      try {
        // First, check if playlist is public
        const { data: playlist, error: playlistError } = await publicSupabase
          .from("playlists")
          .select("*")
          .eq("id", playlistId)
          .eq("is_public", true)
          .single();
        
        if (playlistError || !playlist) {
          throw new Error("Playlist not found or not public");
        }

        // Get playlist tracks separately
        const { data: playlistTracks, error: tracksError } = await publicSupabase
          .from("playlist_tracks")
          .select(`
            track_id,
            position,
            tracks!inner (
              id,
              title,
              artist,
              duration,
              file_url,
              is_public
            )
          `)
          .eq("playlist_id", playlistId)
          .eq("tracks.is_public", true)
          .order("position");

        if (tracksError) {
          console.warn("Error fetching tracks:", tracksError);
        }

        // Map tracks data
        const publicTracks = (playlistTracks || []).map((pt: any) => ({
          id: pt.tracks.id,
          title: pt.tracks.title,
          artist: pt.tracks.artist,
          duration: pt.tracks.duration,
          fileUrl: pt.tracks.file_url,
          addedAt: new Date(),
          is_public: pt.tracks.is_public
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
      } catch (error) {
        console.error("Public playlist fetch error:", error);
        throw error;
      }
    },
    enabled: !!playlistId,
    retry: false // Don't retry on auth errors
  });
};

export const usePublicPlaylistByToken = (shareToken: string) => {
  return useQuery({
    queryKey: ["publicPlaylistByToken", shareToken],
    queryFn: async () => {
      try {
        // First, check if playlist exists with this token and is public
        const { data: playlist, error: playlistError } = await publicSupabase
          .from("playlists")
          .select("*")
          .eq("share_token", shareToken)
          .eq("is_public", true)
          .single();
        
        if (playlistError || !playlist) {
          throw new Error("Playlist not found or not public");
        }

        // Get playlist tracks separately
        const { data: playlistTracks, error: tracksError } = await publicSupabase
          .from("playlist_tracks")
          .select(`
            track_id,
            position,
            tracks!inner (
              id,
              title,
              artist,
              duration,
              file_url,
              is_public
            )
          `)
          .eq("playlist_id", playlist.id)
          .eq("tracks.is_public", true)
          .order("position");

        if (tracksError) {
          console.warn("Error fetching tracks:", tracksError);
        }

        // Map tracks data
        const publicTracks = (playlistTracks || []).map((pt: any) => ({
          id: pt.tracks.id,
          title: pt.tracks.title,
          artist: pt.tracks.artist,
          duration: pt.tracks.duration,
          fileUrl: pt.tracks.file_url,
          addedAt: new Date(),
          is_public: pt.tracks.is_public
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
      } catch (error) {
        console.error("Public playlist by token fetch error:", error);
        throw error;
      }
    },
    enabled: !!shareToken,
    retry: false // Don't retry on auth errors
  });
};