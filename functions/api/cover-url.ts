// functions/api/cover-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_BASE: string;
  PUBLIC_BUCKET: R2Bucket;
  PRIVATE_BUCKET: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const playlistId = url.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing playlist_id", { status: 400 });

    // Bearer optional for public covers, but we’ll accept if provided
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    const supa = createClient(
      env.SUPABASE_URL,
      token ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    // Fetch cover fields + visibility
    const { data: pl, error } = await supa
      .from("playlists")
      .select("id, is_public, cover_storage_type, cover_storage_key, cover_image_url")
      .eq("id", playlistId)
      .single();

    if (error || !pl) return new Response("Not found", { status: 404 });

    // If migrated to R2
    if (pl.cover_storage_type === "r2" && pl.cover_storage_key) {
      if (pl.is_public) {
        const cdn = (env.CDN_BASE || "").replace(/\/+$/, "");
        return json({ url: `${cdn}/${pl.cover_storage_key}` });
      }
      // private cover – stream via image-stream (no Range needed)
      const base = `${url.protocol}//${url.host}`;
      return json({ url: `${base}/api/image-stream?playlist_id=${encodeURIComponent(playlistId)}` });
    }

    // Legacy fallback
    if (pl.cover_image_url) return json({ url: pl.cover_image_url });

    return new Response("No cover", { status: 404 });
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
