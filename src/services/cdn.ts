// src/services/cdn.ts
import { CONFIG } from "@/lib/config";

// 1x1 transparent GIF (prevents broken image icons)
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

// Prefer the canonical CDN; allow VITE_CDN_BASE to override if you ever need to
const CDN_BASE =
  (CONFIG?.IMAGES_CDN_BASE || "").replace(/\/+$/, "") ||
  ((import.meta as any)?.env?.VITE_CDN_BASE || "").replace(/\/+$/, "") ||
  "https://images.wovenmusic.app";

const ABSOLUTE = /^https?:\/\//i;

const encPath = (p: string) =>
  p.split("/").map(encodeURIComponent).join("/");

function normalizeKey(raw: string): string {
  let k = String(raw || "").trim();
  k = k.replace(/^\/+/, ""); // strip leading slashes
  // normalize legacy prefixes to our canonical "images/"
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");
  if (!/^images\//.test(k)) k = `images/${k}`;
  return k;
}

function toCdnUrl(keyLike: string): string {
  const norm = normalizeKey(keyLike);
  return `${CDN_BASE}/${encPath(norm)}`;
}

/**
 * Resolve a playlist/profile image reference to a stable public URL.
 *
 * Accepts EITHER:
 *  - (legacyUrlOrNull) [single-arg usage]
 *  - (legacyUrlOrNull, keyOrNull) [two-arg usage]
 *
 * Rules:
 *  - If `key` is provided: use CDN_BASE + normalized key.
 *  - Else if `legacyUrl` is absolute and is an R2 public URL under /images/,
 *    rewrite to CDN_BASE.
 *  - Else if `legacyUrl` is absolute and not R2: pass through as-is (legacy).
 *  - Else treat the single argument as a key-like string and build CDN URL.
 *  - If nothing is available, return a transparent GIF.
 */
export function resolveImageUrl(
  legacyUrlOrNull?: string | null,
  keyOrNull?: string | null
): string {
  const key = (keyOrNull || "").trim();
  if (key) return toCdnUrl(key);

  const val = (legacyUrlOrNull || "").trim();
  if (!val) return BLANK;

  if (ABSOLUTE.test(val)) {
    try {
      const u = new URL(val);
      const host = u.hostname;
      const path = u.pathname.replace(/^\/+/, "");
      const cdnHost = new URL(CDN_BASE).hostname;

      // already canonical
      if (host === cdnHost) return val;

      // Known R2 public endpoints — canonicalize when path begins with images/
      const isR2Public =
        host.endsWith(".r2.dev") ||
        host.endsWith(".r2.cloudflarestorage.com");
      if (isR2Public && path.startsWith("images/")) {
        return toCdnUrl(path);
      }

      // Unknown absolute URL (e.g., legacy external host) — pass through
      return val;
    } catch {
      // fall through and treat as key-like
    }
  }

  // Treat single arg as a key-like path
  return toCdnUrl(val);
}
