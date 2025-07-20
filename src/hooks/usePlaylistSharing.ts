import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSharePlaylist = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, email }: { playlistId: string; email: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user profile for inviter name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // Get playlist details
      const { data: playlist } = await supabase
        .from("playlists")
        .select("name, share_token")
        .eq("id", playlistId)
        .single();

      if (!playlist) throw new Error("Playlist not found");

      // Generate share token if not exists
      let shareToken = playlist.share_token;
      if (!shareToken) {
        shareToken = crypto.randomUUID();
        const { error: updateError } = await supabase
          .from("playlists")
          .update({ share_token: shareToken })
          .eq("id", playlistId);

        if (updateError) throw updateError;
      }

      // Insert the share record
      const { error } = await supabase
        .from("playlist_shares")
        .insert({
          playlist_id: playlistId,
          email,
          invited_by: user.id
        });

      if (error) throw error;

      // Send email invitation
      const { error: emailError } = await supabase.functions.invoke("send-playlist-invite", {
        body: {
          playlistId,
          email,
          playlistName: playlist.name,
          inviterName: profile?.full_name || "Someone"
        }
      });

      if (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't throw error for email failure, the share was still created
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useUpdatePlaylistVisibility = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, isPublic }: { playlistId: string; isPublic: boolean }) => {
      // Generate share token if making public and none exists
      let updateData: any = { is_public: isPublic };
      
      if (isPublic) {
        const { data: playlist } = await supabase
          .from("playlists")
          .select("share_token")
          .eq("id", playlistId)
          .single();

        if (!playlist?.share_token) {
          updateData.share_token = crypto.randomUUID();
        }
      }

      const { error } = await supabase
        .from("playlists")
        .update(updateData)
        .eq("id", playlistId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useRemovePlaylistShare = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playlistId, email }: { playlistId: string; email: string }) => {
      const { error } = await supabase
        .from("playlist_shares")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("email", email);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};