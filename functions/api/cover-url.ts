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
  // Normalize legacy prefixes, ensure under images/, and for bare filenames
  // default to playlist covers location: images/playlists/<file>
  let k = raw.trim().replace(/^\/+/, "");
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");

  // Bare filename → treat as playlist cover
  if (!k.includes("/")) k = `images/playlists/${k}`;

  // If it's exactly "images/<file>" (one segment after images), also treat as playlist cover
  if (/^images\/[^/]+$/.test(k)) {
    k = k.replace(/^images\//, "images/playlists/");
  }

  if (!k.startsWith("images/")) k = `images/${k}`;
  return k;
}

function toCanonicalImageUrlFromKey(rawKey: string, base?: string) {
  const cdn = (base || DEFAULT_IMAGES_BASE).replace(/\/+$/, "");
  const key = normalizeImageKey(rawKey);
  return `${cdn}/${encodePath(key)}`;
}

function extractCoverKeyOrUrl(pl: any, imagesBase?: string): string | null {
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
    ]) || null;

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

  // If it's not absolute, it's already a key-like string
  if (!isHttp(url)) return url;

  // If absolute: only strip origin if it's our CDN or a public R2 endpoint.
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname.replace(/^\/+/, "");
    const cdnHost = new URL(imagesBase || DEFAULT_IMAGES_BASE).hostname;
    const isR2Public = host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");

    // For our CDN or R2 public endpoints, return just the path (key)
    if ((host === cdnHost || isR2Public) && path) return path;

    // For other absolute hosts, return the absolute URL as-is (pass-through)
    return url;
  } catch {
    // Invalid URL → treat as key-ish string
    return url;
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
    const { data: pl, error } = await supa
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (error || !pl) return new Response("Not found", { status: 404 });

    const raw = extractCoverKeyOrUrl(pl, env.CDN_IMAGES_BASE || DEFAULT_IMAGES_BASE);
    if (!raw) return new Response("No cover", { status: 404 });

    // If we got a full absolute URL for a non-R2/non-CDN host, return it as-is.
    if (isHttp(raw)) {
      return new Response(JSON.stringify({ url: raw }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
        },
      });
    }

    // Otherwise treat it as a key and canonicalize to our CDN
    const urlStr = toCanonicalImageUrlFromKey(raw, env.CDN_IMAGES_BASE);
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
