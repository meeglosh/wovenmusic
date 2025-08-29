import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { playlistImageSrc } from "@/services/imageFor";

// Create a separate Supabase client without auth for public access
const publicSupabase = createClient(
  "https://woakvdhlpludrttjixxq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYWt2ZGhscGx1ZHJ0dGppeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMjMwODEsImV4cCI6MjA2NjY5OTA4MX0.TklesWo8b-lZW2SsE39icrcC0Y8ho5xzGUdj9MZg-Xg",
  {
    auth: {
      persistSession: false
    }
  }
);

export const usePublicPlaylist = (playlistId: string) => {
  return useQuery({
    queryKey: ["publicPlaylist", playlistId],
    queryFn: async () => {
      console.log("Fetching public playlist:", playlistId);

      try {
        // First check if playlist is public
        // Note: share_token is intentionally excluded for security
        const { data: playlist, error: playlistError } = await publicSupabase
          .from("playlists")
          .select("id, name, image_url, created_at, updated_at, is_public")
          .eq("id", playlistId)
          .eq("is_public", true)
          .single();
        
        if (playlistError || !playlist) {
          console.error("Playlist error:", playlistError);
          throw new Error("Playlist not found or not public");
        }

        console.log("Found playlist:", playlist.name);

        // Get all tracks in this playlist (simplified query)
        const { data: playlistTracks, error: tracksError } = await publicSupabase
          .from("playlist_tracks")
          .select("track_id, position")
          .eq("playlist_id", playlistId)
          .order("position");

        if (tracksError) {
          console.warn("Playlist tracks error:", tracksError);
        }

        // Get track details for public tracks only
        let publicTracks: any[] = [];
        if (playlistTracks && playlistTracks.length > 0) {
          const trackIds = playlistTracks.map(pt => pt.track_id);
          
          const { data: tracks, error: trackDetailsError } = await publicSupabase
            .from("tracks")
            .select("id, title, artist, duration, file_url")
            .in("id", trackIds)
            .eq("is_public", true);

          if (trackDetailsError) {
            console.warn("Track details error:", trackDetailsError);
          } else if (tracks) {
            // Match tracks with playlist order
            publicTracks = playlistTracks
              .map(pt => {
                const track = tracks.find(t => t.id === pt.track_id);
                return track ? {
                  id: track.id,
                  title: track.title,
                  artist: track.artist,
                  duration: track.duration,
                  fileUrl: track.file_url,
                  addedAt: new Date(),
                  is_public: true
                } : null;
              })
              .filter(Boolean);
          }
        }

        console.log("Returning playlist with", publicTracks.length, "public tracks");
        
        return {
          id: playlist.id,
          name: playlist.name,
          imageUrl: playlistImageSrc(playlist),
          tracks: publicTracks,
          isPublic: playlist.is_public,
          // Note: share_token intentionally omitted for security
          createdAt: new Date(playlist.created_at)
        };
      } catch (error) {
        console.error("Public playlist fetch error:", error);
        throw error;
      }
    },
    enabled: !!playlistId,
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const usePublicPlaylistByToken = (shareToken: string) => {
  return useQuery({
    queryKey: ["publicPlaylistByToken", shareToken],
    queryFn: async () => {
      console.log("Fetching public playlist by token:", shareToken);

      try {
        // Access playlist via share token (this is allowed by the new RLS policy)
        const { data: playlist, error: playlistError } = await publicSupabase
          .from("playlists")
          .select("id, name, image_url, created_at, updated_at, is_public")
          .eq("share_token", shareToken)
          .eq("is_public", true)
          .single();
        
        if (playlistError || !playlist) {
          console.error("Playlist by token error:", playlistError);
          throw new Error("Playlist not found or not public");
        }

        console.log("Found playlist by token:", playlist.name);

        // Get all tracks in this playlist
        const { data: playlistTracks, error: tracksError } = await publicSupabase
          .from("playlist_tracks")
          .select("track_id, position")
          .eq("playlist_id", playlist.id)
          .order("position");

        if (tracksError) {
          console.warn("Playlist tracks by token error:", tracksError);
        }

        // Get track details for public tracks only
        let publicTracks: any[] = [];
        if (playlistTracks && playlistTracks.length > 0) {
          const trackIds = playlistTracks.map(pt => pt.track_id);
          
          const { data: tracks, error: trackDetailsError } = await publicSupabase
            .from("tracks")
            .select("id, title, artist, duration, file_url")
            .in("id", trackIds)
            .eq("is_public", true);

          if (trackDetailsError) {
            console.warn("Track details by token error:", trackDetailsError);
          } else if (tracks) {
            // Match tracks with playlist order
            publicTracks = playlistTracks
              .map(pt => {
                const track = tracks.find(t => t.id === pt.track_id);
                return track ? {
                  id: track.id,
                  title: track.title,
                  artist: track.artist,
                  duration: track.duration,
                  fileUrl: track.file_url,
                  addedAt: new Date(),
                  is_public: true
                } : null;
              })
              .filter(Boolean);
          }
        }

        console.log("Returning playlist by token with", publicTracks.length, "public tracks");
        
        return {
          id: playlist.id,
          name: playlist.name,
          imageUrl: playlistImageSrc(playlist),
          tracks: publicTracks,
          isPublic: playlist.is_public,
          // Note: share_token intentionally omitted for security
          createdAt: new Date(playlist.created_at)
        };
      } catch (error) {
        console.error("Public playlist by token fetch error:", error);
        throw error;
      }
    },
    enabled: !!shareToken,
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
};