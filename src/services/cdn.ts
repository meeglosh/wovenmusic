// src/services/cdn.ts
// Canonical images CDN base
const CDN_BASE =
  (import.meta as any)?.env?.VITE_CDN_IMAGES_BASE ||
  "https://images.wovenmusic.app";

function isHttp(s?: string): s is string {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

function encodePath(p: string) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function normalizeKey(raw: string): string {
  // Normalize legacy prefixes and make sure keys live under images/
  // Bare filenames and "images/<file>" become "images/playlists/<file>"
  let k = (raw || "").trim().replace(/^\/+/, "");
  if (!k) return "";

  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");

  // Bare filename → treat as playlist cover
  if (!k.includes("/")) k = `images/playlists/${k}`;

  // "images/<file>" (one segment after images) → playlist cover
  if (/^images\/[^/]+$/.test(k)) {
    k = k.replace(/^images\//, "images/playlists/");
  }

  if (!k.startsWith("images/")) k = `images/${k}`;
  return k;
}

/**
 * Resolve an image URL for the app.
 * Accepts either:
 *  - resolveImageUrl(image_url)                // single arg (URL or key)
 *  - resolveImageUrl(image_url, image_key)     // two args (image_url preferred)
 */
export function resolveImageUrl(urlOrKey?: string, maybeKey?: string): string {
  // Prefer explicit key if provided as the 2nd argument
  const raw =
    (maybeKey && maybeKey.trim()) ||
    (urlOrKey && urlOrKey.trim()) ||
    "";

  if (!raw) return "";

  // Absolute URL?
  if (isHttp(raw)) {
    try {
      const u = new URL(raw);
      const host = u.hostname;
      const path = u.pathname.replace(/^\/+/, "");
      const cdnHost = new URL(CDN_BASE).hostname;
      const isR2Public =
        host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");

      // If it’s our CDN or a public R2 endpoint, rewrite to canonical CDN base
      if ((host === cdnHost || isR2Public) && path) {
        const key = normalizeKey(path);
        return `${CDN_BASE}/${encodePath(key)}`;
      }

      // Otherwise leave external absolute URLs as-is
      return raw;
    } catch {
      // Fall through and treat as key-ish
    }
  }

  // Key-ish input
  const key = normalizeKey(raw);
  return key ? `${CDN_BASE}/${encodePath(key)}` : "";
}
