// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_AUDIO_BASE?: string; // optional for public audio via CDN
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function getOrigin(u: URL) { return `${u.protocol}//${u.host}`; }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Grab any bearer the frontend sent us (it can, because this is a fetch)
    const auth = request.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    // Verify user (bearer required to ask for private URLs)
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(bearer || "");
    const userId = userRes?.user?.id || null;

    // Service role for ACL + track read
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: track, error } = await supa
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type")
      .eq("id", trackId)
      .single();

    if (error || !track) return new Response("Not found", { status: 404 });

    // If in R2
    if (track.storage_type === "r2" && track.storage_key) {
      if (track.is_public) {
        // Public: return direct CDN URL if you’ve set one
        const cdn = (env.CDN_AUDIO_BASE || "").replace(/\/+$/, "");
        if (cdn) return json({ url: `${cdn}/${track.storage_key}` });
        // Fallback to our proxy (works too)
        const base = getOrigin(url);
        return json({ url: `${base}/api/track-stream?id=${encodeURIComponent(trackId)}` });
      }

      // Private track: we must embed a token since <audio> can’t send headers
      if (!userId || !bearer) return new Response("Unauthorized", { status: 401 });

      // (We already did an auth.getUser with this bearer; that’s enough for now.)
      const base = getOrigin(url);
      const ts = Date.now(); // cache-busting / prevent reuse by players
      const streamUrl = `${base}/api/track-stream?id=${encodeURIComponent(trackId)}&token=${encodeURIComponent(bearer)}&ts=${ts}`;
      return json({ url: streamUrl });
    }

    // Legacy fallbacks
    if (track.storage_url) return json({ url: track.storage_url });
    if (track.file_url) return json({ url: track.file_url });

    return new Response("No storage handle", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
