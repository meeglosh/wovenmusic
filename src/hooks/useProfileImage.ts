import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUploadProfileImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      // Use the new image-upload edge function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'profile');

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
      // Invalidate profile queries to update UI
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const useDeleteProfileImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile to remove avatar_key and avatar_url
      const { data, error } = await supabase
        .from("profiles")
        .update({ 
          avatar_key: null,
          avatar_url: null 
        })
        .eq("id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  });
};