
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Playlist } from "@/types/music";

export const usePlaylists = () => {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select(`
          *,
          playlist_tracks (
            track_id,
            position
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        trackIds: playlist.playlist_tracks
          .sort((a, b) => a.position - b.position)
          .map(pt => pt.track_id),
        createdAt: new Date(playlist.created_at),
        sharedWith: [] // We'll implement sharing later
      })) as Playlist[];
    }
  });
};

export const useCreatePlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("playlists")
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    }
  });
};

export const useAddTrackToPlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      // Get current max position
      const { data: existingTracks } = await supabase
        .from("playlist_tracks")
        .select("position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1);
      
      const nextPosition = existingTracks?.length ? existingTracks[0].position + 1 : 0;
      
      const { data, error } = await supabase
        .from("playlist_tracks")
        .insert({
          playlist_id: playlistId,
          track_id: trackId,
          position: nextPosition
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    }
  });
};

export const useReorderPlaylistTracks = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, trackIds }: { playlistId: string; trackIds: string[] }) => {
      // Update positions for all tracks in the playlist
      const updates = trackIds.map((trackId, index) => ({
        playlist_id: playlistId,
        track_id: trackId,
        position: index
      }));

      // First, delete all existing tracks for this playlist
      await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId);

      // Then insert them in the new order
      const { data, error } = await supabase
        .from("playlist_tracks")
        .insert(updates)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    }
  });
};

export const useRemoveTrackFromPlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      const { error } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    }
  });
};
