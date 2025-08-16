import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MentionNotificationRequest {
  playlistId: string;
  commentId: string;
  content: string;
  mentions: string[]; // Array of usernames mentioned (without @)
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const { playlistId, commentId, content, mentions }: MentionNotificationRequest = await req.json();

    // Initialize Supabase client with auth header
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the commenter's profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: commenterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    // Get playlist details
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("name, share_token, id")
      .eq("id", playlistId)
      .single();

    if (playlistError || !playlist) {
      throw new Error("Playlist not found");
    }

    // Find mentioned users by their exact display names or emails (case insensitive)
    console.log("Searching for mentions:", mentions);
    
    const mentionQueries = mentions.map(mention => 
      supabase
        .from("profiles")
        .select("id, email, full_name, is_band_member")
        .eq("is_band_member", true)
        .or(`full_name.ilike.%${mention}%,email.ilike.%${mention}%`)
    );

    const mentionResults = await Promise.all(mentionQueries);
    console.log("Mention query results:", mentionResults.map(r => ({ data: r.data, error: r.error })));
    
    const mentionedUsers = mentionResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((user, index, self) => 
        // Remove duplicates based on user ID
        index === self.findIndex(u => u.id === user.id)
      );

    console.log("Found mentioned users:", mentionedUsers);

    if (!mentionedUsers || mentionedUsers.length === 0) {
      console.log("No valid mentioned users found");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create the playlist URL using environment variable
    const baseUrl = Deno.env.get('BASE_URL') || 'https://wovenmusic.app';
    // Use share_token if available, otherwise fall back to playlist ID with comment anchor
    const playlistUrl = playlist.share_token 
      ? `${baseUrl}/?playlist=${playlist.share_token}#comments`
      : `${baseUrl}/?playlist=${playlist.id}&comment=${commentId}#comments`;

    // Send emails to mentioned users
    const emailPromises = mentionedUsers.map(async (mentionedUser) => {
      // Don't send email to the commenter themselves
      if (mentionedUser.id === user.id) {
        return null;
      }

      return await resend.emails.send({
        from: "Wovenmusic <onboarding@resend.dev>",
        to: [mentionedUser.email],
        subject: `You were mentioned in a comment on "${playlist.name}"`,
        html: `
          <h1>You were mentioned in a playlist comment!</h1>
          <p><strong>${commenterProfile?.full_name || commenterProfile?.email || "Someone"}</strong> mentioned you in a comment on the playlist "<strong>${playlist.name}</strong>".</p>
          
          <div style="background-color: #f8f9fa; padding: 16px; border-left: 4px solid #2563eb; margin: 20px 0; font-style: italic;">
            "${content}"
          </div>
          
          <div style="margin: 20px 0;">
            <a href="${playlistUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Comment Thread
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you didn't expect this notification, you can safely ignore this email.
          </p>
        `,
      });
    });

    const emailResults = await Promise.allSettled(emailPromises.filter(Boolean));
    const successCount = emailResults.filter(result => result.status === 'fulfilled').length;
    const failureCount = emailResults.filter(result => result.status === 'rejected').length;

    console.log(`Mention notifications sent: ${successCount} successful, ${failureCount} failed`);

    if (failureCount > 0) {
      const failures = emailResults
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason);
      console.error("Email sending failures:", failures);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sent: successCount,
      failed: failureCount,
      totalMentioned: mentionedUsers.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-mention-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);