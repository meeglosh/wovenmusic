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

  // R2 bindings exist in the project, but this route doesn't touch them directly.
  // (Streaming happens via /api/track-stream using the PRIVATE_BUCKET binding.)
  PUBLIC_BUCKET: R2Bucket;
  PRIVATE_BUCKET: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Bearer token from the client
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

    const { data: hasAccess, error: accessErr } = await supa.rpc(
      "has_track_access",
      { p_user: userId, p_track: trackId }
    );
    if (accessErr) {
      console.error("has_track_access error", accessErr);
      return new Response("Server error", { status: 500 });
    }
    if (!hasAccess) return new Response("Forbidden", { status: 403 });

    // Load track
    const { data: track, error: trkErr } = await supa
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type")
      .eq("id", trackId)
      .single();

    if (trkErr || !track) return new Response("Not found", { status: 404 });

    // R2-first path
    if (track.storage_type === "r2" && track.storage_key) {
      // If you ever mark audio public, serve from a CDN/base (optional)
      if (track.is_public && env.CDN_BASE) {
        const cdn = env.CDN_BASE.replace(/\/+$/, "");
        return json({ url: `${cdn}/${track.storage_key}` });
      }

      // Private audio -> stream through our proxy (Range-supported), no AWS SDK
      const origin = `${url.protocol}//${url.host}`;
      return json({ url: `${origin}/api/track-stream?id=${encodeURIComponent(trackId)}` });
    }

    // Legacy fallbacks (Supabase storage / direct URLs)
    if (track.storage_url) return json({ url: track.storage_url });
    if (track.file_url) return json({ url: track.file_
