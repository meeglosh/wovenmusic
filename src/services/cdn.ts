const CDN = import.meta.env.VITE_CDN_BASE?.replace(/\/+$/, "") || "";

/** Map any known legacy host → current CDN base */
function rewriteLegacyHost(u: string) {
  try {
    const url = new URL(u);

    // 1) Legacy "cdn.wovenmusic.app" links (often with %2F)
    if (url.hostname === "cdn.wovenmusic.app") {
      // decode %2F etc. back to normal slashes
      const decodedPath = decodeURIComponent(url.pathname);
      // Keep query/hash if present
      return `${CDN}${decodedPath}${url.search}${url.hash}`;
    }

    // 2) Supabase public storage URLs → rewrite into R2 path
    if (url.hostname.endsWith(".supabase.co")) {
      const m = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)$/);
      if (m?.[1]) return `${CDN}/${m[1]}`;
    }

    return u;
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
