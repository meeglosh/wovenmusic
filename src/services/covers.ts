// src/services/covers.ts
import { resolveImageUrl } from "@/services/cdn";

function appendQuery(u: string, q: string) {
  return u.includes("?") ? `${u}&${q}` : `${u}?${q}`;
}

/**
 * Prefer thumb URLs if present. Always append a cache-busting version so
 * updates are visible immediately (even if CDN or SW has an old copy).
 */
export function coverUrlForPlaylist(p: {
  // known fields we might see
  id?: string | null;
  cover_thumb_url?: string | null;
  thumb_url?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  image_url?: string | null;
  image_key?: string | null;
  // any "version-ish" fields we can use
  image_updated_at?: string | null;
  updated_at?: string | null;
  updatedAt?: Date | string | number | null;
  version?: number | string | null;
}) {
  // pick a base
  const baseRaw =
    p.cover_thumb_url ??
    p.thumb_url ??
    p.cover_url ??
    p.coverUrl ??
    p.image_url ??
    (p.id ? `/api/cover-redirect?playlist_id=${encodeURIComponent(p.id)}` : "") ||
    "";

  if (!baseRaw) return "";

  const absolute = resolveImageUrl(baseRaw);

  // derive a version number for cache-busting
  const vRaw =
    p.image_updated_at ??
    p.updated_at ??
    (p.updatedAt instanceof Date ? p.updatedAt.getTime() : p.updatedAt) ??
    p.version;

  const v =
    typeof vRaw === "number"
      ? vRaw
      : vRaw
      ? Date.parse(String(vRaw)) || Date.now()
      : undefined;

  return v ? appendQuery(absolute, `v=${v}`) : absolute;
}
