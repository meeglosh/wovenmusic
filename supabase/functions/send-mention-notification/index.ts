// supabase/functions/send-mention-notification/index.ts
import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

// IMPORTANT: do NOT instantiate Resend at top-level.
// Some npm modules can throw during module init under the edge runtime.
// We'll import & init it lazily inside the POST branch.
type ResendType = typeof import("npm:resend@2.0.0").Resend;

const ALLOWED_ORIGINS = new Set<string>([
  "https://wovenmusic.app",
  "https://wovenmusic-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function buildCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://wovenmusic.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, sb-access-token",
    "Access-Control-Max-Age": "86400",
  };
}

interface MentionNotificationRequest {
  playlistId: string;
  commentId: string;
  content: string;
  mentions: string[];
}

serve(async (req: Request): Promise<Response> => {
  const cors = buildCors(req);

  // 1) CORS preflight: return immediately, no body parsing, no imports
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    // 2) Parse request body (POST only)
    const { playlistId, commentId, content, mentions }: MentionNotificationRequest = await req.json();

    // 3) Create Supabase client. Authorization is ONLY required on POST; preflight doesn't send it.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    );

    // 4) Get commenter
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: commenterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    // 5) Get playlist
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("name, share_token, id")
      .eq("id", playlistId)
      .single();
    if (playlistError || !playlist) {
      return new Response(JSON.stringify({ error: "Playlist not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 6) Lookup mentioned users (band members only) by name/email (ilike)
    const mentionResults = await Promise.all(
      (mentions ?? []).map((m) =>
        supabase
          .from("profiles")
          .select("id, email, full_name, is_band_member")
          .eq("is_band_member", true)
          .or(`full_name.ilike.%${m}%,email.ilike.%${m}%`)
      )
    );

    const mentionedUsers = mentionResults
      .filter((r) => !r.error && r.data)
      .flatMap((r) => r.data!)
      .filter((u, i, arr) => i === arr.findIndex((x) => x.id === u.id))
      .filter((u) => u.id !== user.id); // don’t email the commenter

    // If nobody to notify, return success
    if (!mentionedUsers.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, totalMentioned: 0 }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 7) Build deep link
    const baseUrl = Deno.env.get("BASE_URL") || "https://wovenmusic.app";
    const playlistUrl = playlist.share_token
      ? `${baseUrl}/?playlist=${playlist.share_token}#comments`
      : `${baseUrl}/?playlist=${playlist.id}&comment=${commentId}#comments`;

    // 8) Lazy import & init Resend (POST only; won’t affect OPTIONS)
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { Resend } = await import("npm:resend@2.0.0") as unknown as { Resend: ResendType };
    const resend = new Resend(resendKey);

    // 9) Send emails
    const sender = "Wovenmusic <onboarding@resend.dev>"; // consider verified domain
    const commentAuthor = commenterProfile?.full_name || commenterProfile?.email || "Someone";

    const emailJobs = mentionedUsers.map((u) =>
      resend.emails.send({
        from: sender,
        to: [u.email],
        subject: `You were mentioned in a comment on "${playlist.name}"`,
        html: `
          <h1>You were mentioned in a playlist comment!</h1>
          <p><strong>${commentAuthor}</strong> mentioned you on "<strong>${playlist.name}</strong>".</p>
          <div style="background:#f8f9fa;padding:16px;border-left:4px solid #2563eb;margin:20px 0;font-style:italic;">
            "${content}"
          </div>
          <div style="margin:20px 0;">
            <a href="${playlistUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
              View Comment Thread
            </a>
          </div>
        `,
      })
    );

    const results = await Promise.allSettled(emailJobs);
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ success: true, sent, failed, totalMentioned: mentionedUsers.length }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Always respond with CORS headers, even on errors
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
