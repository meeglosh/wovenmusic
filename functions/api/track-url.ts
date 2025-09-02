import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // optional: if you have a public audio CDN for *public* tracks
  CDN_AUDIO_BASE?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const originOf = (u: URL) => `${u.protocol}//${u.host}`;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const trackId = u.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    const auth = request.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(bearer || "");
    const userId = userRes?.user?.id || null;

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: track, error } = await supa
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type")
      .eq("id", trackId)
      .single();

    if (error || !track) return new Response("Not found", { status: 404 });

    // R2 path
    if (track.storage_type === "r2" && track.storage_key) {
      if (track.is_public) {
        const cdn = (env.CDN_AUDIO_BASE || "").replace(/\/+$/, "");
        if (cdn) return json({ url: `${cdn}/${track.storage_key}` });
        // or stream via proxy
        const base = originOf(u);
        return json({ url: `${base}/api/track-stream?id=${encodeURIComponent(trackId)}` });
      }

      // Private track -> bake the Supabase token into the URL (since <audio> can’t send headers)
      if (!userId || !bearer) return new Response("Unauthorized", { status: 401 });
      const base = originOf(u);
      const ts = Date.now();
      return json({
        url: `${base}/api/track-stream?id=${encodeURIComponent(trackId)}&token=${encodeURIComponent(
          bearer
        )}&ts=${ts}`,
      });
    }

    // legacy fallbacks
    if (track.storage_url) return json({ url: track.storage_url });
    if (track.file_url) return json({ url: track.file_url });

    return new Response("No storage handle", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
