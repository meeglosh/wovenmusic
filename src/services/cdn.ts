const CDN = import.meta.env.VITE_CDN_BASE?.replace(/\/+$/, "") || "";

/** Map any known legacy host → current CDN base */
function rewriteLegacyHost(u: string) {
  try {
    const url = new URL(u);
    // Legacy CDN host that currently has no DNS. Rewrite to R2 base:
    if (url.hostname === "cdn.wovenmusic.app") {
      // Keep the path exactly as-is (don’t double-encode slashes)
      return `${CDN}${url.pathname}${url.search}${url.hash}`;
    }
    // Legacy Supabase public bucket host → rewrite to R2 if needed (optional)
    if (url.hostname.endsWith(".supabase.co")) {
      // If your DB stored full Supabase URLs for images, map their path into R2’s layout:
      // Example: /storage/v1/object/public/images/playlists/<file>
      // becomes: /images/playlists/<file>
      const m = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)$/);
      if (m?.[1]) return `${CDN}/${m[1]}`;
    }
    return u; // pass-through for any other http(s) URLs (Dropbox, etc.)
  } catch {
    return u;
  }
}

/** Encode only the filename (not directory slashes) */
function joinAndEncode(base: string, keyOrPath: string) {
  const clean = keyOrPath.replace(/^\/+/, "");
  const i = clean.lastIndexOf("/");
  if (i === -1) return `${base}/${encodeURIComponent(clean)}`;
  const dir = clean.slice(0, i);
  const file = clean.slice(i + 1);
  return `${base}/${dir}/${encodeURIComponent(file)}`;
}

/**
 * Canonical resolver for any image:
 * - If you give a full URL → normalize/host-rewrite
 * - If you give a storage key/path → build against VITE_CDN_BASE
 */
export function resolveImageUrl(input?: string | null, keyOrPath?: string | null) {
  // Prefer an explicit URL from DB if provided
  if (input && /^https?:\/\//i.test(input)) {
    return rewriteLegacyHost(input);
  }
  // Otherwise construct from a key/path (e.g. "images/playlists/abc.png")
  if (keyOrPath) {
    return joinAndEncode(CDN, keyOrPath);
  }
  return ""; // callers should handle placeholder if empty
}
