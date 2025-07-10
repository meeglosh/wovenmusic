import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDeleteTrack = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase
        .from("tracks")
        .delete()
        .eq("id", trackId);
      
      if (error) throw error;
      return trackId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    }
  });
};