// src/services/cdn.ts
// Canonical images CDN base for the frontend.
// Reads from Vite env at build time and falls back to the production domain.

const envAny = (import.meta as any)?.env ?? {};
const CDN_BASE: string =
  envAny.VITE_CDN_IMAGES_BASE ||
  envAny.VITE_CDN_BASE || // legacy support if it exists
  "https://images.wovenmusic.app";

// Expose for quick console verification
try {
  // @ts-ignore
  (window as any).__CDN_IMAGES_BASE__ = CDN_BASE;
  // eslint-disable-next-line no-console
  console.info("CDN base:", CDN_BASE);
} catch { /* ignore on SSR */ }

function isHttp(s?: string): s is string {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

function encodePath(p: string) {
  return p.split("/").map(encodeURIComponent).join("/");
}

/**
 * Normalize to a key rooted under "images/" without forcing a "playlists/" segment.
 * Accepts either an absolute URL or a key-ish string.
 */
function normalizeKey(input: string): string {
  let k = (input || "").trim();
  if (!k) return "";

  // Absolute URL? keep just the path as our key
  if (isHttp(k)) {
    try {
      const u = new URL(k);
      k = u.pathname.replace(/^\/+/, "");
    } catch {
      // fall through and treat as key-ish
    }
  }

  // Legacy prefixes -> images/
  k = k.replace(/^\/+/, "");
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");

  // Ensure under images/, but DO NOT inject "playlists/"
  if (!k.startsWith("images/")) k = `images/${k}`;

  return k;
}

/**
 * Resolve an image URL for the app.
 * - Use both fields when you have them: resolveImageUrl(image_url, image_key)
 * - We prefer the explicit key if provided.
 */
export function resolveImageUrl(urlOrKey?: string, maybeKey?: string): string {
  const picked =
    (maybeKey && maybeKey.trim()) ||
    (urlOrKey && urlOrKey.trim()) ||
    "";
  if (!picked) return "";

  const key = normalizeKey(picked);
  return `${CDN_BASE}/${encodePath(key)}`;
}
