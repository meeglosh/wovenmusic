// functions/api/image-stream.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;          // not used here, but kept for symmetry
  SUPABASE_SERVICE_ROLE_KEY: string;
  // Optional override; defaults to your canonical CDN:
  // e.g., "https://images.wovenmusic.app"
  CDN_IMAGES_BASE?: string;
};

function encodePath(p: string) {
  // encode each segment but keep slashes
  return p.split("/").map(encodeURIComponent).join("/");
}

function toCanonicalImageUrl(rawKey: string, base: string) {
  let k = (rawKey || "").trim();
  // tolerate legacy prefixes and missing "images/"
  k = k.replace(/^playlist-images\//, "images/");
  if (!k.startsWith("images/")) k = `images/${k}`;
  const safeKey = encodePath(k);
  const cdn = (base || "https://images.wovenmusic.app").replace(/\/+$/, "");
  return `${cdn}/${safeKey}`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const cdnBase = env.CDN_IMAGES_BASE || "https://images.wovenmusic.app";

    // 1) If a direct key is provided, just normalize and redirect.
    const key = u.searchParams.get("key");
    if (key) {
      const target = toCanonicalImageUrl(key, cdnBase);
      return Response.redirect(target, 302);
    }

    // 2) Otherwise, support legacy usage: ?playlist_id=... → look up cover key in DB.
    const playlistId = u.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing key or playlist_id", { status: 400 });

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: pl, error } = await supa
      .from("playlists")
      .select("cover_storage_key, cover_storage_type")
      .eq("id", playlistId)
      .single();

    if (error || !pl?.cover_storage_key || pl.cover_storage_type !== "r2") {
      return new Response("Not found", { status: 404 });
    }

    const target = toCanonicalImageUrl(pl.cover_storage_key, cdnBase);
    return Response.redirect(target, 302);
  } catch (e) {
    console.error("image-stream error", e);
    return new Response("Server error", { status: 500 });
  }
};
