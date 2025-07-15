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
          // Try to delete from both possible buckets
          let deleteSuccess = false;
          
          // First try transcoded-audio bucket (for converted WAV files)
          if (fileName.includes('.mp3') || fileName.includes('transcoded')) {
            const { error: transcodedError } = await supabase.storage
              .from('transcoded-audio')
              .remove([fileName]);
            
            if (!transcodedError) {
              deleteSuccess = true;
            } else {
              console.warn('Failed to delete from transcoded-audio bucket:', transcodedError);
            }
          }
          
          // If not found in transcoded bucket, try audio-files bucket (for direct uploads)
          if (!deleteSuccess) {
            const { error: audioError } = await supabase.storage
              .from('audio-files')
              .remove([fileName]);
            
            if (audioError) {
              console.warn('Failed to delete from audio-files bucket:', audioError);
            }
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
          // Group files by bucket type
          const transcodedFiles = fileNames.filter(name => name.includes('.mp3') || name.includes('transcoded'));
          const audioFiles = fileNames.filter(name => !transcodedFiles.includes(name));
          
          // Delete from transcoded-audio bucket
          if (transcodedFiles.length > 0) {
            const { error: transcodedError } = await supabase.storage
              .from('transcoded-audio')
              .remove(transcodedFiles);
            
            if (transcodedError) {
              console.warn('Failed to delete files from transcoded-audio bucket:', transcodedError);
            }
          }
          
          // Delete from audio-files bucket
          if (audioFiles.length > 0) {
            const { error: audioError } = await supabase.storage
              .from('audio-files')
              .remove(audioFiles);
            
            if (audioError) {
              console.warn('Failed to delete files from audio-files bucket:', audioError);
            }
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