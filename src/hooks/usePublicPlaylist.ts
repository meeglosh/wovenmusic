import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { playlistImageSrc } from "@/services/imageFor";

// Prefer env, fall back to current hardcoded values for public, non-auth access
const PUBLIC_SUPABASE_URL =
  (import.meta as any)?.env?.VITE_PUBLIC_SUPABASE_URL ||
  "https://woakvdhlpludrttjixxq.supabase.co";

const PUBLIC_SUPABASE_ANON_KEY =
  (import.meta as any)?.env?.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYWt2ZGhscGx1ZHJ0dGppeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMjMwODEsImV4cCI6MjA2NjY5OTA4MX0.TklesWo8b-lZW2SsE39icrcC0Y8ho5xzGUdj9MZg-Xg";

// Separate Supabase client without auth for public access
const publicSupabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const mapTracksInPlaylistOrder = (
  playlistTracks: Array<{ track_id: string; position: number }>,
  tracks: Array<{
    id: string;
    title: string;
    artist: string;
    duration: string;
    file_url: string | null;
    storage_url: string | null;
  }>
) => {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  return playlistTracks
    .map((pt) => {
      const t = byId.get(pt.track_id);
      if (!t) return null;
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        // Prefer modern storage_url, fallback to legacy file_url
        fileUrl: t.storage_url || t.file_url || "",
        addedAt: new Date(), // public view—no per-user addedAt
        is_public: true,
      };
    })
    .filter(Boolean) as any[];
};

export const usePublicPlaylist = (playlistId: string) => {
  return useQuery({
    queryKey: ["publicPlaylist", playlistId],
    enabled: !!playlistId,
    retry: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      // 1) Fetch the public playlist
      const { data: playlist, error: playlistError } = await publicSupabase
        .from("playlists")
        .select("id, name, image_url, created_at, updated_at, is_public")
        .eq("id", playlistId)
        .eq("is_public", true)
        .single();

      if (playlistError || !playlist) {
        throw new Error("Playlist not found or not public");
      }

      // 2) Fetch playlist track ids in order
      const { data: playlistTracks, error: tracksError } = await publicSupabase
        .from("playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      if (tracksError) {
        // Soft-fail: return an empty tracklist but still show playlist metadata
        return {
          id: playlist.id,
          name: playlist.name,
          imageUrl: playlistImageSrc(playlist),
          tracks: [] as any[],
          isPublic: playlist.is_public,
          createdAt: new Date(playlist.created_at),
        };
      }

      let publicTracks: any[] = [];
      if (playlistTracks && playlistTracks.length > 0) {
        const trackIds = playlistTracks.map((pt) => pt.track_id);

        // 3) Fetch only public tracks and include storage_url + file_url
        const { data: tracks } = await publicSupabase
          .from("tracks")
          .select("id, title, artist, duration, file_url, storage_url")
          .in("id", trackIds)
          .eq("is_public", true);

        if (tracks && tracks.length > 0) {
          publicTracks = mapTracksInPlaylistOrder(playlistTracks, tracks);
        }
      }

      return {
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlistImageSrc(playlist),
        tracks: publicTracks,
        isPublic: playlist.is_public,
        createdAt: new Date(playlist.created_at),
      };
    },
  });
};

export const usePublicPlaylistByToken = (shareToken: string) => {
  return useQuery({
    queryKey: ["publicPlaylistByToken", shareToken],
    enabled: !!shareToken,
    retry: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      // 1) Fetch the public playlist by share token
      const { data: playlist, error: playlistError } = await publicSupabase
        .from("playlists")
        .select("id, name, image_url, created_at, updated_at, is_public")
        .eq("share_token", shareToken)
        .eq("is_public", true)
        .single();

      if (playlistError || !playlist) {
        throw new Error("Playlist not found or not public");
        }

      // 2) Fetch playlist track ids in order
      const { data: playlistTracks, error: tracksError } = await publicSupabase
        .from("playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", playlist.id)
        .order("position", { ascending: true });

      if (tracksError) {
        return {
          id: playlist.id,
          name: playlist.name,
          imageUrl: playlistImageSrc(playlist),
          tracks: [] as any[],
          isPublic: playlist.is_public,
          createdAt: new Date(playlist.created_at),
        };
      }

      let publicTracks: any[] = [];
      if (playlistTracks && playlistTracks.length > 0) {
        const trackIds = playlistTracks.map((pt) => pt.track_id);

        // 3) Only public tracks; include storage_url + file_url
        const { data: tracks } = await publicSupabase
          .from("tracks")
          .select("id, title, artist, duration, file_url, storage_url")
          .in("id", trackIds)
          .eq("is_public", true);

        if (tracks && tracks.length > 0) {
          publicTracks = mapTracksInPlaylistOrder(playlistTracks, tracks);
        }
      }

      return {
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlistImageSrc(playlist),
        tracks: publicTracks,
        isPublic: playlist.is_public,
        createdAt: new Date(playlist.created_at),
      };
    },
  });
};
