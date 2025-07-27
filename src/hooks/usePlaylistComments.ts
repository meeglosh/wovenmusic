import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PlaylistComment {
  id: string;
  playlistId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userEmail?: string;
  userFullName?: string;
}

export const usePlaylistComments = (playlistId: string) => {
  return useQuery({
    queryKey: ["playlist-comments", playlistId],
    queryFn: async () => {
      const { data: comments, error } = await supabase
        .from("playlist_comments")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!comments || comments.length === 0) {
        return [];
      }

      // Get user profiles for the comments
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return comments.map(comment => {
        const profile = profileMap.get(comment.user_id);
        return {
          id: comment.id,
          playlistId: comment.playlist_id,
          userId: comment.user_id,
          content: comment.content,
          createdAt: new Date(comment.created_at),
          updatedAt: new Date(comment.updated_at),
          userEmail: profile?.email,
          userFullName: profile?.full_name,
        } as PlaylistComment;
      });
    },
  });
};

export const useAddPlaylistComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (comment: Omit<PlaylistComment, "id" | "createdAt" | "updatedAt">) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("playlist_comments")
        .insert({
          playlist_id: comment.playlistId,
          user_id: user.user.id,
          content: comment.content,
        })
        .select()
        .single();

      if (error) throw error;

      // Check for @mentions and send notifications - updated regex to handle names with spaces
      const mentions = comment.content.match(/@([^@\s]+(?:\s+[^@\s]+)*)/g);
      if (mentions && mentions.length > 0) {
        try {
          await supabase.functions.invoke('send-mention-notification', {
            body: {
              playlistId: comment.playlistId,
              commentId: data.id,
              content: comment.content,
              mentions: mentions.map(m => m.substring(1)), // Remove @ symbol
            }
          });
        } catch (error) {
          console.warn("Failed to send mention notifications:", error);
        }
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-comments", variables.playlistId] });
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePlaylistComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, content, playlistId }: { commentId: string; content: string; playlistId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("playlist_comments")
        .update({ content })
        .eq("id", commentId)
        .eq("user_id", user.user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-comments", variables.playlistId] });
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeletePlaylistComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, playlistId }: { commentId: string; playlistId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("playlist_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.user.id);

      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-comments", variables.playlistId] });
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      });
    },
  });
};