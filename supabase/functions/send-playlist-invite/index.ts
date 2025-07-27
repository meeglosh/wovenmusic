import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PlaylistInviteRequest {
  playlistId: string;
  email: string;
  playlistName: string;
  inviterName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const { playlistId, email, playlistName, inviterName }: PlaylistInviteRequest = await req.json();

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

    // Get playlist details
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("share_token, name")
      .eq("id", playlistId)
      .single();

    if (playlistError || !playlist) {
      throw new Error("Playlist not found");
    }

    // Generate share URL using environment variable
    const baseUrl = Deno.env.get('BASE_URL') || 'https://wovenmusic.app';
    const shareUrl = `${baseUrl}/?playlist=${playlist.share_token}`;

    const emailResponse = await resend.emails.send({
      from: "Wovenmusic <onboarding@resend.dev>",
      to: [email],
      subject: `${inviterName || "Someone"} shared a playlist with you: ${playlistName}`,
      html: `
        <h1>You've been invited to listen to a playlist!</h1>
        <p><strong>${inviterName || "Someone"}</strong> has shared the playlist "<strong>${playlistName}</strong>" with you.</p>
        
        <div style="margin: 20px 0;">
          <a href="${shareUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Listen to Playlist
          </a>
        </div>
        
        <p>Or copy and paste this link: <a href="${shareUrl}">${shareUrl}</a></p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      `,
    });

    console.log("Playlist invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-playlist-invite function:", error);
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