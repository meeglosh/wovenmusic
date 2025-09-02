// src/services/cdn.ts
// Canonicalize any playlist/profile image handle (key or URL) to images.wovenmusic.app

const DEFAULT_BASE = "https://images.wovenmusic.app";

// Use the Vite runtime env if present; otherwise default to canonical.
// (This must never be undefined—even inside the SW.)
export const CDN_IMAGES_BASE: string =
  (import.meta as any)?.env?.VITE_CDN_IMAGES_BASE || DEFAULT_BASE;

// Turn a possibly-absolute URL into a path if it's one of our R2/public endpoints.
// If it's some other host entirely (e.g. Supabase storage), return the absolute URL as-is.
function toPathIfKnownR2Host(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const isR2 =
      host.endsWith(".r2.cloudflarestorage.com") ||
      host.endsWith(".r2.dev") ||
      host === new URL(CDN_IMAGES_BASE).hostname;

    if (!isR2) return null; // foreign host → keep absolute URL
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function normalizeKeyLike(input: string): string {
  // Strip leading slashes
  let k = input.replace(/^\/+/, "");

  // Legacy prefixes → images/
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");

  // If it’s just a filename, assume playlist covers
  if (!k.includes("/")) k = `images/playlists/${k}`;
  if (!k.startsWith("images/")) k = `images/${k}`;

  // Encode each segment safely
  const encoded = k.split("/").map(encodeURIComponent).join("/");
  return `${CDN_IMAGES_BASE.replace(/\/+$/, "")}/${encoded}`;
}

/**
 * Accepts either a key-ish string ("images/...png", "playlist-images/...png", "cover.png")
 * or a full old/public R2 URL and returns a canonical https://images.wovenmusic.app/... URL.
 * If it's a non-R2 absolute URL, we return it untouched.
 * Returns "" if input is empty.
 */
export function resolveImageUrl(keyOrUrl?: string | null): string {
  if (!keyOrUrl) return "";

  const raw = String(keyOrUrl).trim();
  if (!raw) return "";

  // Absolute URL?
  if (/^https?:\/\//i.test(raw)) {
    const path = toPathIfKnownR2Host(raw);
    if (path) return normalizeKeyLike(path);
    // Not one of ours → leave it alone
    return raw;
  }

  // Path / key case
  return normalizeKeyLike(raw);
}
