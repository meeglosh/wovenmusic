// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Optional: public CDN base if you ever serve public audio
  // e.g. "https://audio.wovenmusic.app"
  CDN_BASE?: string;

  // R2 buckets are bound in Pages settings, but this route
  // does not touch them directly (streaming done by /api/track-stream).
  PUBLIC_BUCKET: R2Bucket;
  PRIVATE_BUCKET: R2Bucket;
};

type TrackRow = {
  id: string;
  is_public: boolean;
  storage_type: string | null; // 'r2' | ...
  storage_key: string | null;
  storage_url?: string | null; // legacy
  file_url?: string | null;    // legacy
  mime_type?: string | null;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Bearer token from the client (required for private tracks)
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    // Verify user with anon client + token
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // Access check via service role
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

    // Load track row
    const { data: track, error: trkErr } = await supa
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type")
      .eq("id", trackId)
      .single<TrackRow>();

    if (trkErr || !track) return new Response("Not found", { status: 404 });

    // R2-first
    if (track.storage_type === "r2" && track.storage_key) {
      // If you ever mark audio public, you can serve from a CDN base
      if (track.is_public && env.CDN_BASE) {
        const cdn = env.CDN_BASE.replace(/\/+$/, "");
        return json({ url: `${cdn}/${track.storage_key}` });
      }
      // Private (or no CDN): stream via our proxy which reads from the R2 binding (supports Range)
      const origin = `${url.protocol}//${url.host}`;
      return json({ url: `${origin}/api/track-stream?id=${encodeURIComponent(trackId)}` });
    }

    // Legacy fallbacks
    if (track.storage_url) return json({ url: track.storage_url });
    if (track.file_url) return json({ url: track.file_url });

    return new Response("No storage handle", { status: 404 });
  } catch (e) {
    console.error("track-url error", e);
    return new Response("Server error", { status: 500 });
  }
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
