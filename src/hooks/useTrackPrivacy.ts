import { useMutation, useQueryClient } from "@tanstack/react-query";
import { r2StorageService } from "@/services/r2StorageService";
import { useUpdateTrack } from "./useTracks";

export const useTrackPrivacy = () => {
  const queryClient = useQueryClient();
  const updateTrack = useUpdateTrack();
  
  return useMutation({
    mutationFn: async ({ trackId, newIsPublic }: { trackId: string; newIsPublic: boolean }) => {
      // First transfer the file in R2 if needed
      await r2StorageService.transferTrack(trackId, newIsPublic);
      
      // Update the track privacy in the database
      await updateTrack.mutateAsync({
        id: trackId,
        updates: { is_public: newIsPublic }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};