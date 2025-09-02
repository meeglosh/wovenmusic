// functions/api/cover-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // Optional override; default to canonical images CDN
  CDN_IMAGES_BASE?: string; // e.g. "https://images.wovenmusic.app"
};

const DEFAULT_IMAGES_BASE = "https://images.wovenmusic.app";

function pickFirst<T extends object>(o: T | null | undefined, keys: string[]): string | null {
  if (!o) return null;
  for (const k of keys) {
    const v = (o as any)[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isHttp(s: string) {
  return /^https?:\/\//i.test(s);
}

function encodePath(p: string) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function normalizeImageKey(raw: string): string {
  let k = raw.trim();
  // tolerate legacy prefix and missing "images/"
  k = k.replace(/^playlist-images\//, "images/");
  if (!k.startsWith("images/")) k = `images/${k}`;
  return k;
}

function toCanonicalImageUrlFromKey(rawKey: string, base?: string) {
  const cdn = (base || DEFAULT_IMAGES_BASE).replace(/\/+$/, "");
  const key = normalizeImageKey(rawKey);
  return `${cdn}/${encodePath(key)}`;
}

function extractCoverKey(pl: any, imagesBase?: string): string | null {
  // Prefer explicit key-ish fields
  const key =
    pickFirst(pl, [
      "cover_storage_key",
      "cover_key",
      "image_key",
      "artwork_key",
      "cover_path",
      "image_path",
      "key",
    ]) ||
    null;

  if (key) return key;

  // Fall back to URL-ish fields
  const url =
    pickFirst(pl, [
      "cover_image_url",
      "image_url",
      "cover_url",
      "artwork_url",
      "thumbnail_url",
      "cover",
      "image",
    ]) || null;

  if (!url) return null;

  if (!isHttp(url)) {
    // looks like a relative key already
    return url;
  }

  // Strip origin if it points at our CDN (or anything https://<host>/<path>)
  try {
    const u = new URL(url);
    // if it was our CDN domain, path is the key
    if (!u.pathname || u.pathname === "/") return null;
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const playlistId = u.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing playlist_id", { status: 400 });

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Be schema-agnostic: select *
    const { data: pl, error } = await supa.from("playlists").select("*").eq("id", playlistId).single();

    if (error || !pl) return new Response("Not found", { status: 404 });

    const rawKey = extractCoverKey(pl, env.CDN_IMAGES_BASE || DEFAULT_IMAGES_BASE);
    if (!rawKey) return new Response("No cover", { status: 404 });

    const urlStr = toCanonicalImageUrlFromKey(rawKey, env.CDN_IMAGES_BASE);
    return new Response(JSON.stringify({ url: urlStr }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("cover-url error", e);
    return new Response("Server error", { status: 500 });
  }
};
