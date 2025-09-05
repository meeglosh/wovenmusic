// src/services/cdn.ts
// Canonicalize any playlist/profile image handle (key or URL) to images.wovenmusic.app
// and expose small helpers used by other services/components.

const DEFAULT_BASE = "https://images.wovenmusic.app";

/**
 * Prefer Vite-style env first, then allow a plain `CDN_IMAGES_BASE`, else default.
 * (Kept local to avoid importing CONFIG here.)
 */
export const CDN_IMAGES_BASE: string =
  (import.meta as any)?.env?.VITE_CDN_IMAGES_BASE ||
  (import.meta as any)?.env?.CDN_IMAGES_BASE ||
  DEFAULT_BASE;

/** Defensive host extraction for comparisons */
function baseHost(): string {
  try {
    return new URL(CDN_IMAGES_BASE).hostname;
  } catch {
    return new URL(DEFAULT_BASE).hostname;
  }
}

/** True if string looks like an absolute http(s) URL */
export function isAbsoluteUrl(u?: string | null): boolean {
  return !!u && /^https?:\/\//i.test(String(u));
}

/**
 * If `raw` is a URL pointing at R2 (or already at our CDN),
 * return just the path part (no leading slash). Otherwise null.
 */
function toPathIfKnownR2Host(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const known =
      host.endsWith(".r2.cloudflarestorage.com") ||
      host.endsWith(".r2.dev") ||
      host === baseHost();

    if (!known) return null;

    // Drop leading slash; keep path only (ignore query for canonicalization).
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

/**
 * Normalize a key-ish string to our canonical CDN URL.
 * Accepts various legacy prefixes and bare filenames.
 */
function normalizeKeyLike(input: string): string {
  let k = String(input).trim().replace(/^\/+/, "");

  // Legacy top-level prefixes → "images/...".
  k = k.replace(/^playlist-images\//i, "images/");
  k = k.replace(/^profile-images\//i, "images/");

  // If starts with playlists/ or profiles/, mount under images/
  if (/^(playlists|profiles)\//i.test(k)) {
    k = `images/${k}`;
  }

  // If it already starts with images/, keep; otherwise mount under images/
  if (!k.startsWith("images/")) {
    k = `images/${k}`;
  }

  // If it's just "images/<filename>" with no subfolder, assume playlists/
  const rest = k.slice("images/".length);
  if (rest && !rest.includes("/")) {
    k = `images/playlists/${rest}`;
  }

  // Collapse accidental double slashes, then URL-encode each segment.
  k = k.replace(/\/{2,}/g, "/");
  const encoded = k.split("/").map(encodeURIComponent).join("/");

  return `${CDN_IMAGES_BASE.replace(/\/+$/, "")}/${encoded}`;
}

/**
 * Build a full CDN image URL from a stored object key like:
 *  - images/playlists/<id>/cover.jpg
 *  - playlists/<id>/cover.jpg
 *  - cover.jpg (assumed playlists/)
 */
export function cdnImageFromKey(key?: string | null): string | null {
  if (!key) return null;
  return normalizeKeyLike(String(key));
}

/**
 * Main resolver used by callers:
 *  - If given an absolute URL to R2/our CDN → canonicalize onto CDN base.
 *  - If given an absolute URL to a foreign host → return as-is.
 *  - If given a key-ish string → return canonical CDN URL.
 */
export function resolveImageUrl(keyOrUrl?: string | null): string {
  if (!keyOrUrl) return "";

  const raw = String(keyOrUrl).trim();
  if (!raw) return "";

  if (isAbsoluteUrl(raw)) {
    const path = toPathIfKnownR2Host(raw);
    if (path) return normalizeKeyLike(path); // normalize onto our CDN base
    return raw; // foreign host → leave untouched
  }

  return normalizeKeyLike(raw);
}
