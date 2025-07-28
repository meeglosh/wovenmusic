import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlaylistCategory {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const usePlaylistCategories = () => {
  return useQuery({
    queryKey: ["playlist-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_categories")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as PlaylistCategory[];
    }
  });
};

export const usePlaylistCategoryLinks = () => {
  return useQuery({
    queryKey: ["playlist-category-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_category_links")
        .select(`
          *,
          playlist_categories (
            id,
            name
          )
        `);
      
      if (error) throw error;
      return data;
    }
  });
};

export const useGetPlaylistCategories = (playlistId: string) => {
  return useQuery({
    queryKey: ["playlist-categories", playlistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_category_links")
        .select(`
          playlist_categories (
            id,
            name
          )
        `)
        .eq("playlist_id", playlistId);
      
      if (error) throw error;
      return data?.map(link => link.playlist_categories).filter(Boolean) || [];
    }
  });
};

export const useAssignPlaylistCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, categoryId }: { playlistId: string; categoryId: string }) => {
      const { data, error } = await supabase
        .from("playlist_category_links")
        .insert({
          playlist_id: playlistId,
          category_id: categoryId
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-category-links"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-categories"] });
    }
  });
};

export const useRemovePlaylistCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, categoryId }: { playlistId: string; categoryId: string }) => {
      const { error } = await supabase
        .from("playlist_category_links")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("category_id", categoryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-category-links"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-categories"] });
    }
  });
};