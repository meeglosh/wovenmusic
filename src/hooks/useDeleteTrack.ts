import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDeleteTrack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (trackId: string) => {
      // First get the track to check if it has a file_url (uploaded file) vs dropbox_path (Dropbox file)
      const { data: track, error: fetchError } = await supabase
        .from("tracks")
        .select("file_url, dropbox_path")
        .eq("id", trackId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // If the track has a file_url and no dropbox_path, it's a stored file - delete from storage
      const isStoredFile = track?.file_url && !track?.dropbox_path;
      if (isStoredFile) {
        const fileName = track.file_url.split('/').pop();
        if (fileName) {
          console.log('Attempting to delete file:', fileName);
          
          // Try both buckets - don't assume which one based on filename
          const { error: transcodedError } = await supabase.storage
            .from('transcoded-audio')
            .remove([fileName]);
          
          const { error: audioError } = await supabase.storage
            .from('audio-files')
            .remove([fileName]);
          
          // Log results (at least one should succeed, both may fail if file doesn't exist)
          if (transcodedError && audioError) {
            console.warn('File not found in either bucket:', { transcodedError, audioError });
          } else {
            if (!transcodedError) console.log('Successfully deleted from transcoded-audio bucket');
            if (!audioError) console.log('Successfully deleted from audio-files bucket');
          }
        }
      }
      
      // Delete the track record from database
      const { error } = await supabase
        .from("tracks")
        .delete()
        .eq("id", trackId);
      
      if (error) throw error;
      return { trackId, isStoredFile };
    },
    onSuccess: () => {
      // Force refetch the tracks data
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.refetchQueries({ queryKey: ["tracks"] });
    }
  });
};

export const useBulkDeleteTracks = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (trackIds: string[]) => {
      // First get all tracks to check which have file_urls (uploaded files) vs dropbox_path (Dropbox files)
      const { data: tracks, error: fetchError } = await supabase
        .from("tracks")
        .select("id, file_url, dropbox_path")
        .in("id", trackIds);
      
      if (fetchError) throw fetchError;
      
      // Delete stored files from storage (files with file_url but no dropbox_path)
      const storedFiles = tracks?.filter(track => track.file_url && !track.dropbox_path) || [];
      if (storedFiles.length > 0) {
        const fileNames = storedFiles
          .map(track => track.file_url?.split('/').pop())
          .filter(Boolean) as string[];
        
        if (fileNames.length > 0) {
          console.log('Attempting to delete files:', fileNames);
          
          // Try to delete from both buckets for all files
          const { error: transcodedError } = await supabase.storage
            .from('transcoded-audio')
            .remove(fileNames);
          
          const { error: audioError } = await supabase.storage
            .from('audio-files')
            .remove(fileNames);
          
          // Log results
          if (transcodedError && audioError) {
            console.warn('Some files may not have been found in either bucket:', { transcodedError, audioError });
          } else {
            if (!transcodedError) console.log('Successfully attempted deletion from transcoded-audio bucket');
            if (!audioError) console.log('Successfully attempted deletion from audio-files bucket');
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
        storedCount: storedFiles.length,
        dropboxCount: trackIds.length - storedFiles.length
      };
    },
    onSuccess: () => {
      // Force refetch the tracks data
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.refetchQueries({ queryKey: ["tracks"] });
    }
  });
};