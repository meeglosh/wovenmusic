// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_BASE: string;
  PUBLIC_BUCKET: R2Bucket;   // bound in Pages settings
  PRIVATE_BUCKET: R2Bucket;  // bound in Pages settings
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Supabase bearer from frontend
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    // Verify user
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // Access check (service role)
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: hasAccess, error: rpcErr } = await supa.rpc("has_track_access", {
      p_user: userId,
      p_track: trackId,
    });

    if (rpcErr) {
      console.error("has_track_access error", rpcErr);
      return new Response("Server error", { status: 500 });
    }
    if (!hasAccess) return new Response("Forbidden", { status: 403 });

    // Load track storage handle
    const { data: track, error: trkErr } = await supa
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type")
      .eq("id", trackId)
      .single();

    if (trkErr || !track) return new Response("Not found", { status: 404 });

    // R2-first happy path
    if (track.storage_type === "r2" && track.storage_key) {
      if (track.is_public) {
        // Public files: return CDN URL
        const cdn = (env.CDN_BASE || "").replace(/\/+$/, "");
        return json({ url: `${cdn}/${track.storage_key}` });
      } else {
        // Private files: stream through our proxy (supports Range)
        const base = getOrigin(url);
        return json({ url: `${base}/api/track-stream?id=${encodeURIComponent(trackId)}` });
      }
    }

    // Fallback for legacy rows (Supabase storage or old direct URL)
    if (track.storage_url) return json({ url: track.storage_url });
    if (track.file_url) return json({ url: track.file_url });

    return new Response("No storage handle", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function getOrigin(u: URL) {
  return `${u.protocol}//${u.host}`;
}
