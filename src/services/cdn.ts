// src/services/cdn.ts
// Canonicalize any playlist/profile image handle (key or URL) to images.wovenmusic.app

const DEFAULT_BASE = "https://images.wovenmusic.app";

export const CDN_IMAGES_BASE: string =
  (import.meta as any)?.env?.VITE_CDN_IMAGES_BASE || DEFAULT_BASE;

function toPathIfKnownR2Host(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const isR2 =
      host.endsWith(".r2.cloudflarestorage.com") ||
      host.endsWith(".r2.dev") ||
      host === new URL(CDN_IMAGES_BASE).hostname;

    if (!isR2) return null;
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function normalizeKeyLike(input: string): string {
  let k = input.replace(/^\/+/, "");

  // Legacy prefixes → images/
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");

  // If it's just a filename, assume playlist covers
  if (!k.includes("/")) k = `images/playlists/${k}`;

  // If it's "images/<file>" (no subfolder), also assume playlists/
  if (k.startsWith("images/")) {
    const rest = k.slice("images/".length);
    if (rest && !rest.includes("/")) {
      k = `images/playlists/${rest}`;
    }
  }

  if (!k.startsWith("images/")) k = `images/${k}`;

  const encoded = k.split("/").map(encodeURIComponent).join("/");
  return `${CDN_IMAGES_BASE.replace(/\/+$/, "")}/${encoded}`;
}

export function resolveImageUrl(keyOrUrl?: string | null): string {
  if (!keyOrUrl) return "";

  const raw = String(keyOrUrl).trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    const path = toPathIfKnownR2Host(raw);
    if (path) return normalizeKeyLike(path);
    return raw; // foreign host → leave as-is
  }

  return normalizeKeyLike(raw);
}
