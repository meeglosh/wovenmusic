// functions/api/cover-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Optional override, defaults to your canonical CDN:
  // e.g. "https://images.wovenmusic.app"
  CDN_IMAGES_BASE?: string;
};

function encodePath(p: string) {
  // encode each segment but keep slashes intact
  return p.split("/").map(encodeURIComponent).join("/");
}

function toCanonicalImageUrl(rawKey: string, base?: string) {
  let k = (rawKey || "").trim();
  // tolerate old prefixes and missing "images/"
  k = k.replace(/^playlist-images\//, "images/");
  if (!k.startsWith("images/")) k = `images/${k}`;

  const cdn = (base || "https://images.wovenmusic.app").replace(/\/+$/, "");
  return `${cdn}/${encodePath(k)}`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const playlistId = u.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing playlist_id", { status: 400 });

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Look up the cover fields
    const { data: pl, error } = await supa
      .from("playlists")
      .select("cover_storage_type, cover_storage_key, cover_image_url")
      .eq("id", playlistId)
      .single();

    if (error || !pl) return new Response("Not found", { status: 404 });

    // Preferred path: R2-backed cover key -> canonical CDN URL
    if (pl.cover_storage_type === "r2" && pl.cover_storage_key) {
      const url = toCanonicalImageUrl(pl.cover_storage_key, env.CDN_IMAGES_BASE);
      return json({ url });
    }

    // Legacy fallback
    if (pl.cover_image_url) return json({ url: pl.cover_image_url });

    return new Response("No cover", { status: 404 });
  } catch (e) {
    console.error("cover-url error", e);
    return new Response("Server error", { status: 500 });
  }
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
}
