// supabase/functions/send-mention-notification/index.ts
import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

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

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  try {
    // Body
    const { playlistId, commentId, content, mentions }: MentionNotificationRequest = await req.json();

    // Clients: user-scoped (for identity) + service-role (for cross-user reads)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    );

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = serviceRoleKey
      ? createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey)
      : supabaseUser; // fallback if not set (RLS may block lookups)

    // Who is commenting?
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, code: "unauthorized", message: "User not authenticated" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Commenter profile (optional)
    const { data: commenterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    // Playlist (use service client to avoid RLS surprises)
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("name, share_token, id")
      .eq("id", playlistId)
      .single();
    if (playlistError || !playlist) {
      return new Response(JSON.stringify({ ok: false, code: "playlist_not_found", playlistId }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Mentions lookup:
    //   allow band members OR admins,
    //   match full_name/email (ilike),
    //   dedupe,
    //   exclude commenter
    const mentionResults = await Promise.all(
      (mentions ?? []).map((m) =>
        supabase
          .from("profiles")
          .select("id, email, full_name, is_band_member, role")
          .or("is_band_member.eq.true,role.eq.admin") // broadened
          .or(`full_name.ilike.%${m}%,email.ilike.%${m}%`)
      )
    );

    const mentionedUsers = mentionResults
      .filter((r) => !r.error && r.data)
      .flatMap((r) => r.data!)
      .filter((u, i, arr) => i === arr.findIndex((x) => x.id === u.id))
      .filter((u) => u.id !== user.id);

    if (!mentionedUsers.length) {
      return new Response(JSON.stringify({
        ok: true, sent: 0, failed: 0, totalMentioned: 0, recipients: [],
        info: "no_matching_profiles",
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Deep link
    const baseUrl = Deno.env.get("BASE_URL") || "https://wovenmusic.app";
    const playlistUrl = playlist.share_token
      ? `${baseUrl}/?playlist=${playlist.share_token}#comments`
      : `${baseUrl}/?playlist=${playlist.id}&comment=${commentId}#comments`;

    // Resend
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, code: "resend_key_missing", message: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { Resend } = await import("npm:resend@2.0.0") as unknown as { Resend: ResendType };
    const resend = new Resend(resendKey);

    const sender = "Wovenmusic <noreply@wovenmusic.app>"; // use a verified sender domain in Resend
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
    const delivery = results.map((r, i) => ({
      recipient: mentionedUsers[i]?.email,
      status: r.status,
      reason: r.status === "rejected" ? String((r as PromiseRejectedResult).reason) : undefined,
    }));
    const sent = delivery.filter((d) => d.status === "fulfilled").length;

    return new Response(JSON.stringify({
      ok: true,
      sent,
      failed: delivery.length - sent,
      totalMentioned: mentionedUsers.length,
      recipients: mentionedUsers.map(u => ({ id: u.id, email: u.email, name: u.full_name })),
      delivery
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, code: "exception", message: String(e) }), {
      status: 500,
      headers: { ...buildCors(req), "Content-Type": "application/json" },
    });
  }
});
