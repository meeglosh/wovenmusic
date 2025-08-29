
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Playlist } from "@/types/music";
import { playlistImageSrc } from "@/services/imageFor";

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
          ),
          playlist_shares (
            email
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Get all unique creator IDs
      const creatorIds = [...new Set(data.map(p => p.created_by).filter(Boolean))];
      
      // Fetch creator profiles
      let creatorProfiles: any[] = [];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        creatorProfiles = profiles || [];
      }
      
      return data.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        artistName: playlist.artist_name,
        imageUrl: playlistImageSrc(playlist),
        trackIds: playlist.playlist_tracks
          .sort((a, b) => a.position - b.position)
          .map(pt => pt.track_id),
        createdAt: new Date(playlist.created_at),
        sharedWith: playlist.playlist_shares?.map(share => share.email) || [],
        isPublic: playlist.is_public,
        shareToken: playlist.share_token,
        created_by: playlist.created_by,
        createdByName: creatorProfiles.find(p => p.id === playlist.created_by)?.full_name || 'Unknown User'
      })) as Playlist[];
    }
  });
};

export const useCreatePlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, artistName }: { name: string; artistName?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("playlists")
        .insert({ 
          name,
          artist_name: artistName?.trim() || null,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch playlists to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
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
      // Invalidate both playlists query to update the sidebar and specific queries
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      // Force refetch of playlists to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ["playlists"] });
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
      // Invalidate and refetch playlists to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
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
      // Invalidate and refetch playlists to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
    }
  });
};

export const useUpdatePlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, name, imageUrl, artistName }: { id: string; name?: string; imageUrl?: string; artistName?: string | null }) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (imageUrl !== undefined) updateData.image_url = imageUrl;
      if (artistName !== undefined) updateData.artist_name = artistName;
      
      const { data, error } = await supabase
        .from("playlists")
        .update(updateData)
        .eq("id", id)
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

export const useDeletePlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (playlistId: string) => {
      // Delete playlist tracks first (cascade should handle this, but being explicit)
      await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId);
      
      // Delete the playlist
      const { error } = await supabase
        .from("playlists")
        .delete()
        .eq("id", playlistId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    }
  });
};

export const useUploadPlaylistImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ file, playlistId }: { file: File; playlistId: string }) => {
      // Use the new image-upload edge function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'playlist');
      formData.append('entityId', playlistId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('https://woakvdhlpludrttjixxq.supabase.co/functions/v1/image-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};
export const useDeletePlaylistImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (playlistId: string) => {
      // Update playlist to remove image_key and image_url
      const { data, error } = await supabase
        .from("playlists")
        .update({ 
          image_key: null,
          image_url: null 
        })
        .eq("id", playlistId)
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
