// src/services/cdn.ts
// Canonical image resolver used by the UI.
// Accepts either an absolute legacy URL OR a storage key and returns the
// canonical CDN URL on images.wovenmusic.app.

const CDN_BASE =
  (import.meta as any)?.env?.VITE_CDN_IMAGES_BASE ||
  "https://images.wovenmusic.app";

function isHttp(s: string) {
  return /^https?:\/\//i.test(s);
}

function encodePath(p: string) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function normalizeKey(raw: string): string {
  // Strip leading slashes
  let k = String(raw || "").trim().replace(/^\/+/, "");
  // Collapse legacy prefixes
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");

  // Bare filename → assume playlist covers
  if (!k.includes("/")) k = `images/playlists/${k}`;

  // If it's exactly "images/<file>" (one segment after images),
  // also treat as a playlist cover.
  if (/^images\/[^/]+$/.test(k)) {
    k = k.replace(/^images\//, "images/playlists/");
  }

  // Ensure it lives under images/
  if (!k.startsWith("images/")) k = `images/${k}`;
  return k;
}

/**
 * Resolve a canonical image URL.
 * - If input is an absolute URL:
 *   - If it’s already our CDN or an R2 public host, rewrite to CDN.
 *   - Otherwise, return as-is.
 * - If input is a key/filename, normalize to images/... and join to CDN.
 */
export function resolveImageUrl(input?: string): string {
  const val = (input || "").trim();
  if (!val) return "";

  if (isHttp(val)) {
    try {
      const u = new URL(val);
      const host = u.hostname;
      const path = u.pathname.replace(/^\/+/, "");
      const cdnHost = new URL(CDN_BASE).hostname;
      const isR2Public =
        host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");

      if ((host === cdnHost || isR2Public) && path) {
        const key = normalizeKey(path);
        return `${CDN_BASE.replace(/\/+$/, "")}/${encodePath(key)}`;
      }
      return val; // external URL: pass-through
    } catch {
      /* fall through to key normalization */
    }
  }

  const key = normalizeKey(val);
  return `${CDN_BASE.replace(/\/+$/, "")}/${encodePath(key)}`;
}
