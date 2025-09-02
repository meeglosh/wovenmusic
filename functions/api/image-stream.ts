// functions/api/image-stream.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_IMAGES_BASE?: string; // default to https://images.wovenmusic.app
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
  k = k.replace(/^playlist-images\//, "images/");
  if (!k.startsWith("images/")) k = `images/${k}`;
  return k;
}

function toCanonicalImageUrlFromKey(rawKey: string, base?: string) {
  const cdn = (base || DEFAULT_IMAGES_BASE).replace(/\/+$/, "");
  const key = normalizeImageKey(rawKey);
  return `${cdn}/${encodePath(key)}`;
}

function extractCoverKey(pl: any): string | null {
  const key =
    pickFirst(pl, [
      "cover_storage_key",
      "cover_key",
      "image_key",
      "artwork_key",
      "cover_path",
      "image_path",
      "key",
    ]) || null;

  if (key) return key;

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

  if (!isHttp(url)) return url;

  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const cdnBase = env.CDN_IMAGES_BASE || DEFAULT_IMAGES_BASE;

    // 1) Direct key (fast path)
    const key = u.searchParams.get("key");
    if (key) {
      const target = toCanonicalImageUrlFromKey(key, cdnBase);
      return Response.redirect(target, 302);
    }

    // 2) Legacy: by playlist id
    const playlistId = u.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing key or playlist_id", { status: 400 });

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: pl, error } = await supa.from("playlists").select("*").eq("id", playlistId).single();
    if (error || !pl) return new Response("Not found", { status: 404 });

    const rawKey = extractCoverKey(pl);
    if (!rawKey) return new Response("No cover", { status: 404 });

    const target = toCanonicalImageUrlFromKey(rawKey, cdnBase);
    return Response.redirect(target, 302);
  } catch (e) {
    console.error("image-stream error", e);
    return new Response("Server error", { status: 500 });
  }
};
