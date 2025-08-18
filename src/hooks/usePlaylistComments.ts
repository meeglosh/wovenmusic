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
  parentId?: string | null;
  replies?: PlaylistComment[];
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

      // Organize comments into threads
      const commentMap = new Map<string, PlaylistComment>();
      const rootComments: PlaylistComment[] = [];

      // First pass: create comment objects
      comments.forEach(comment => {
        const profile = profileMap.get(comment.user_id);
        const commentObj: PlaylistComment = {
          id: comment.id,
          playlistId: comment.playlist_id,
          userId: comment.user_id,
          content: comment.content,
          createdAt: new Date(comment.created_at),
          updatedAt: new Date(comment.updated_at),
          userEmail: profile?.email,
          userFullName: profile?.full_name,
          parentId: comment.parent_id,
          replies: [],
        };
        commentMap.set(comment.id, commentObj);
      });

      // Second pass: organize into threads
      commentMap.forEach(comment => {
        if (comment.parentId) {
          const parent = commentMap.get(comment.parentId);
          if (parent && parent.replies) {
            parent.replies.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      });

      // Sort replies within each thread by creation time (oldest first)
      rootComments.forEach(comment => {
        if (comment.replies) {
          comment.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
      });

      return rootComments;
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
          parent_id: comment.parentId,
        })
        .select()
        .single();

      if (error) throw error;

      // Check for @mentions and send notifications - updated regex to handle names with spaces
      const mentions = comment.content.match(/@([^@\s]+(?:\s+[^@\s]+)*)/g);
      console.log("Debug: Found mentions:", mentions);
      if (mentions && mentions.length > 0) {
        console.log("Debug: Sending mention notifications for:", mentions.map(m => m.substring(1)));
        try {
          const result = await supabase.functions.invoke('send-mention-notification', {
            body: {
              playlistId: comment.playlistId,
              commentId: data.id,
              content: comment.content,
              mentions: mentions.map(m => m.substring(1)), // Remove @ symbol
            }
          });
          
          // Enhanced logging for debugging
          console.log("Debug: Complete mention notification response:", {
            success: !result.error,
            data: result.data,
            error: result.error,
            timestamp: new Date().toISOString()
          });
          
          if (result.error) {
            console.error("Mention notification failed:", result.error);
            toast({
              title: "Mention notification failed",
              description: `Error: ${result.error.message || 'Unknown error'}`,
              variant: "destructive",
            });
          } else if (result.data) {
            console.log("Mention notification details:", {
              totalMentioned: result.data.totalMentioned || 0,
              sent: result.data.sent || 0,
              failed: result.data.failed || 0,
              recipients: result.data.recipients || [],
              delivery: result.data.delivery || []
            });
            
            if (result.data.sent > 0) {
              toast({
                title: "Mentions sent",
                description: `Notified ${result.data.sent} user(s)`,
              });
            } else if (result.data.totalMentioned === 0) {
              console.warn("No matching users found for mentions:", mentions);
            }
          }
        } catch (error) {
          console.error("Failed to send mention notifications:", error);
          toast({
            title: "Mention notification error",
            description: "Network error sending notifications",
            variant: "destructive",
          });
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