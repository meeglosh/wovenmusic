// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_BASE?: string;          // e.g. https://audio.wovenmusic.app (optional for public files)
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Extract bearer the frontend sent us
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    // Verify the user (required to ask for a playback URL)
    if (!token) return new Response("Unauthorized", { status: 401 });
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false }});
    const { data: userRes } = await supaAnon.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // Service key for access checks + track row
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }});

    // Optional: reuse your ACL RPC if you have one
    // const { data: hasAccess } = await supa.rpc("has_track_access", { p_user: userId, p_track: trackId });
    // if (!hasAccess) return new Response("Forbidden", { status: 403 });

    const { data: track, error: trkErr } = await supa
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type")
      .eq("id", trackId)
      .single();

    if (trkErr || !track) return new Response("Not found", { status: 404 });

    // R2-first
    if (track.storage_type === "r2" && track.storage_key) {
      if (track.is_public) {
        // Public objects can use a CDN/origin URL if you have one configured
        const cdn = (env.CDN_BASE || "").replace(/\/+$/, "");
        if (cdn) {
          return json({ url: `${cdn}/${track.storage_key}` });
        }
        // Or stream via our proxy without a token (public)
        const base = getOrigin(url);
        return json({ url: `${base}/api/track-stream?id=${encodeURIComponent(trackId)}` });
      } else {
        // PRIVATE: add token param so <audio> can fetch without headers
        const base = getOrigin(url);
        const t = encodeURIComponent(token);
        return json({ url: `${base}/api/track-stream?id=${encodeURIComponent(trackId)}&token=${t}` });
      }
    }

    // Fallbacks (legacy)
    if (track.storage_url) return json({ url: track.storage_url });
    if (track.file_url)    return json({ url: track.file_url });

    return new Response("No storage handle", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}
function getOrigin(u: URL) { return `${u.protocol}//${u.host}`; }
