
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
          ),
          playlist_shares (
            email
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlist.image_url,
        trackIds: playlist.playlist_tracks
          .sort((a, b) => a.position - b.position)
          .map(pt => pt.track_id),
        createdAt: new Date(playlist.created_at),
        sharedWith: playlist.playlist_shares?.map(share => share.email) || [],
        isPublic: playlist.is_public,
        shareToken: playlist.share_token,
        created_by: playlist.created_by
      })) as Playlist[];
    }
  });
};

export const useCreatePlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("playlists")
        .insert({ 
          name,
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
    mutationFn: async ({ id, name, imageUrl }: { id: string; name?: string; imageUrl?: string }) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (imageUrl !== undefined) updateData.image_url = imageUrl;
      
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${playlistId}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('playlist-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('playlist-images')
        .getPublicUrl(fileName);
      
      // Update playlist with image URL
      const { data, error } = await supabase
        .from("playlists")
        .update({ image_url: publicUrl })
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

export const useDeletePlaylistImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (playlistId: string) => {
      // First get the current playlist to get the image URL
      const { data: playlist, error: fetchError } = await supabase
        .from("playlists")
        .select("image_url")
        .eq("id", playlistId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // If there's an image URL, extract the filename and delete it from storage
      if (playlist.image_url) {
        const url = new URL(playlist.image_url);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        const { error: deleteError } = await supabase.storage
          .from('playlist-images')
          .remove([fileName]);
        
        if (deleteError) {
          console.error('Error deleting image from storage:', deleteError);
          // Continue with updating the database even if storage deletion fails
        }
      }
      
      // Update playlist to remove image URL
      const { data, error } = await supabase
        .from("playlists")
        .update({ image_url: null })
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
