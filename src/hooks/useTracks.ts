
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Track } from "@/types/music";

export const useTracks = () => {
  return useQuery({
    queryKey: ["tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        fileUrl: track.file_url || "",  // Use empty string instead of "#"
        addedAt: new Date(track.created_at),
        source_folder: track.source_folder,
        dropbox_path: track.dropbox_path,
        is_public: track.is_public,
        play_count: track.play_count || 0,
        created_by: track.created_by
      })) as Track[];
    }
  });
};

export const useAddTrack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (track: Omit<Track, "id" | "addedAt">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("tracks")
        .insert({
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          file_url: track.fileUrl,
          source_folder: track.source_folder,
          dropbox_path: track.dropbox_path,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};

export const useUpdateTrack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<{ duration: string; title: string; artist: string; is_public: boolean; play_count: number }> }) => {
      const { data, error } = await supabase
        .from("tracks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};

export const useIncrementPlayCount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (trackId: string) => {
      const { data, error } = await supabase
        .from("tracks")
        .select("play_count")
        .eq("id", trackId)
        .single();
      
      if (error) throw error;
      
      const newPlayCount = (data.play_count || 0) + 1;
      
      const { data: updatedData, error: updateError } = await supabase
        .from("tracks")
        .update({ play_count: newPlayCount })
        .eq("id", trackId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      return updatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};
