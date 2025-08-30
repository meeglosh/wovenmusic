const CDN_BASE =
  import.meta.env.VITE_CDN_BASE ||
  "https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com";

function stripLeadingSlash(s: string) {
  return s.startsWith("/") ? s.slice(1) : s;
}

export function resolveImageUrl(legacyUrlOrNull?: string | null, keyOrNull?: string | null) {
  // Preferred: key from DB (e.g. "images/playlists/<uuid>.jpg")
  if (keyOrNull) return `${CDN_BASE}/${stripLeadingSlash(keyOrNull)}`;

  // Legacy: turn ".../images%2Fplaylists%2F<id>.jpg" or ".../images/playlists/<id>.jpg"
  // into "images/playlists/<id>.jpg", then prefix CDN_BASE
  if (legacyUrlOrNull) {
    try {
      const decoded = decodeURIComponent(legacyUrlOrNull);
      const m = decoded.match(/images\/[a-zA-Z0-9/_\-.]+$/);
      if (m) return `${CDN_BASE}/${m[0]}`;
    } catch { /* fall through */ }
    const m = (legacyUrlOrNull).match(/images\/[a-zA-Z0-9/_\-.]+$/);
    if (m) return `${CDN_BASE}/${m[0]}`;
  }

  return ""; // explicit empty (SafeImg will show placeholder)
}