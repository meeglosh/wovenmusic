import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Comment } from "@/types/music";

export const useComments = (trackId: string) => {
  return useQuery({
    queryKey: ["comments", trackId],
    queryFn: async () => {
      // First get comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("track_id", trackId)
        .order("timestamp_seconds", { ascending: true });
      
      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
      
      // Get user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      
      if (profilesError) {
        console.warn("Could not fetch user profiles:", profilesError);
        // Continue without profile data
      }

      // Create a map of user profiles
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });
      }

      return commentsData.map(comment => {
        const profile = profilesMap.get(comment.user_id);
        return {
          id: comment.id,
          trackId: comment.track_id,
          userId: comment.user_id,
          content: comment.content,
          timestampSeconds: comment.timestamp_seconds,
          createdAt: new Date(comment.created_at),
          updatedAt: new Date(comment.updated_at),
          userEmail: profile?.email,
          userFullName: profile?.full_name
        };
      }) as Comment[];
    }
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (comment: Omit<Comment, "id" | "createdAt" | "updatedAt">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("comments")
        .insert({
          track_id: comment.trackId,
          user_id: user.id,
          content: comment.content,
          timestamp_seconds: comment.timestampSeconds
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.trackId] });
    }
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ commentId, content, trackId }: { commentId: string; content: string; trackId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("comments")
        .update({ content })
        .eq("id", commentId)
        .eq("user_id", user.id) // Ensure user can only update their own comments
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.trackId] });
    }
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ commentId, trackId }: { commentId: string; trackId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id); // Ensure user can only delete their own comments
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.trackId] });
    }
  });
};