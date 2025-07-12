import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDeleteTrack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (trackId: string) => {
      // First get the track to check if it has a file_url (uploaded file)
      const { data: track, error: fetchError } = await supabase
        .from("tracks")
        .select("file_url")
        .eq("id", trackId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // If the track has a file_url, it's an uploaded file - delete from storage
      if (track?.file_url) {
        const fileName = track.file_url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('audio-files')
            .remove([fileName]);
          
          if (storageError) {
            console.warn('Failed to delete file from storage:', storageError);
          }
        }
      }
      
      // Delete the track record from database
      const { error } = await supabase
        .from("tracks")
        .delete()
        .eq("id", trackId);
      
      if (error) throw error;
      return { trackId, hadFileUrl: !!track?.file_url };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};

export const useBulkDeleteTracks = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (trackIds: string[]) => {
      // First get all tracks to check which have file_urls (uploaded files)
      const { data: tracks, error: fetchError } = await supabase
        .from("tracks")
        .select("id, file_url")
        .in("id", trackIds);
      
      if (fetchError) throw fetchError;
      
      // Delete uploaded files from storage
      const uploadedFiles = tracks?.filter(track => track.file_url) || [];
      if (uploadedFiles.length > 0) {
        const fileNames = uploadedFiles
          .map(track => track.file_url?.split('/').pop())
          .filter(Boolean) as string[];
        
        if (fileNames.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('audio-files')
            .remove(fileNames);
          
          if (storageError) {
            console.warn('Failed to delete files from storage:', storageError);
          }
        }
      }
      
      // Delete the track records from database
      const { error } = await supabase
        .from("tracks")
        .delete()
        .in("id", trackIds);
      
      if (error) throw error;
      
      return {
        trackIds,
        uploadedCount: uploadedFiles.length,
        dropboxCount: trackIds.length - uploadedFiles.length
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};