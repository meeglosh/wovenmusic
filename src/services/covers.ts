// src/services/covers.ts
import { resolveImageUrl } from "@/services/cdn";

function appendQuery(u: string, q: string) {
  return u.includes("?") ? `${u}&${q}` : `${u}?${q}`;
}

// Robust picker that accepts snake_case and camelCase
function pick<T = string>(
  obj: Record<string, any>,
  ...keys: string[]
): T | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim() !== "") return v as T;
  }
  return undefined;
}

/**
 * Build the best cover URL for a playlist:
 * - Prefer explicit *thumb* URLs (cover_thumb_url, thumb_url, coverThumbUrl, thumbUrl)
 * - Then full cover/image URLs (cover_url, image_url, coverUrl, imageUrl)
 * - Then image keys (image_key, imageKey) via CDN
 * - Finally fallback to /api/cover-redirect?playlist_id=...
 *
 * Always append a cache-busting `v=` param when we can infer an updated time.
 */
export function coverUrlForPlaylist(p: {
  id?: string | null;

  cover_thumb_url?: string | null;
  thumb_url?: string | null;
  cover_url?: string | null;
  image_url?: string | null;

  coverThumbUrl?: string | null;
  thumbUrl?: string | null;
  coverUrl?: string | null;
  imageUrl?: string | null;

  image_key?: string | null;
  imageKey?: string | null;

  image_updated_at?: string | null;
  updated_at?: string | null;
  updatedAt?: Date | string | number | null;
  version?: number | string | null;
}) {
  // 1) Choose a base candidate
  const baseCandidate =
    pick(p, "cover_thumb_url", "thumb_url", "coverThumbUrl", "thumbUrl") ??
    pick(p, "cover_url", "image_url", "coverUrl", "imageUrl") ??
    pick(p, "image_key", "imageKey");

  let base =
    baseCandidate ??
    (p.id ? `/api/cover-redirect?playlist_id=${encodeURIComponent(p.id)}` : "");

  if (!base) return "";

  // 2) Build absolute URL:
  // - If it is app-relative (/something), DO NOT send through resolveImageUrl.
  // - If it's a bare key or an absolute URL, resolveImageUrl will do the right thing.
  const isAppRelative = typeof base === "string" && base.startsWith("/");
  let absolute = isAppRelative ? base : resolveImageUrl(base);

  // 3) Derive a cache-busting version
  const rawV =
    p.image_updated_at ??
    p.updated_at ??
    (p.updatedAt instanceof Date ? p.updatedAt.getTime() : p.updatedAt) ??
    p.version;

  let v: number | undefined;
  if (typeof rawV === "number") {
    v = rawV;
  } else if (rawV != null) {
    const parsed = Date.parse(String(rawV));
    if (!Number.isNaN(parsed)) v = parsed;
  }

  return v ? appendQuery(absolute, `v=${v}`) : absolute;
}
