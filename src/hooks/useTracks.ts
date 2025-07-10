
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
        fileUrl: track.file_url || "#",
        addedAt: new Date(track.created_at),
        source_folder: track.source_folder,
        dropbox_path: track.dropbox_path
      })) as Track[];
    }
  });
};

export const useAddTrack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (track: Omit<Track, "id" | "addedAt">) => {
      const { data, error } = await supabase
        .from("tracks")
        .insert({
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          file_url: track.fileUrl,
          source_folder: track.source_folder,
          dropbox_path: track.dropbox_path
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
