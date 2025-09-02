// src/services/trackUrls.ts
// Frontend-only helpers: ask the backend for a playable URL.
// No AWS SDK imports here.

import { supabase } from "@/integrations/supabase/client";

const RAW_BASE =
  (import.meta as any)?.env?.VITE_APP_API_BASE ||
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  ""; // empty => same-origin (Cloudflare Pages Functions)

const BASE = RAW_BASE.replace(/\/+$/, "");

async function fetchJson(pathWithQuery: string) {
  // Include Supabase bearer if present (needed for private tracks)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) headers["authorization"] = `Bearer ${session.access_token}`;

  const candidates = [
    BASE ? `${BASE}/api/${pathWithQuery}` : "", // e.g. https://api.example.com/api/track-url?id=...
    BASE ? `${BASE}/${pathWithQuery}` : "",     // e.g. https://api.example.com/track-url?id=...
    `/api/${pathWithQuery}`,                    // same-origin CF Pages Function
    `/${pathWithQuery}`,                        // fallback if mounted without /api
  ].filter(Boolean);

  let lastText = "";
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers,
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) return await res.json();
      lastText = await res.text().catch(() => "");
    } catch (e) {
      lastText = (e as Error)?.message || String(e);
    }
  }
  throw new Error(lastText || "track-url request failed");
}

/** Resolve a playable URL (string) for a given track id (public or private). */
export async function getTrackUrl(trackId: string): Promise<string> {
  const data = await fetchJson(`track-url?id=${encodeURIComponent(trackId)}`);
  if (!data?.url) throw new Error(data?.error || "No URL returned");
  return data.url as string;
}

/** Same as above, but returns any extra fields (e.g., expiresAt). */
export async function getTrackUrlWithMeta(
  trackId: string
): Promise<{ url: string; expiresAt?: string; [k: string]: any }> {
  const data = await fetchJson(`track-url?id=${encodeURIComponent(trackId)}`);
  if (!data?.url) throw new Error(data?.error || "No URL returned");
  return data;
}

/** Back-compat: callers expecting `resolveTrackUrl(...)`. */
export async function resolveTrackUrl(
  trackOrId: string | { id: string }
): Promise<string> {
  const id = typeof trackOrId === "string" ? trackOrId : trackOrId?.id;
  if (!id) throw new Error("resolveTrackUrl: missing track id");
  return getTrackUrl(id);
}

/** Optional helper: canonical image URL from a storage key. */
export function getImageUrlFromKey(rawKey: string): string {
  let k = (rawKey || "").trim();
  k = k.replace(/^playlist-images\//, "images/");
  if (!k.startsWith("images/")) k = `images/${k}`;
  // Encode each segment to keep slashes
  return `https://images.wovenmusic.app/${k.split("/").map(encodeURIComponent).join("/")}`;
}

// Default export for legacy imports
const trackUrls = { getTrackUrl, getTrackUrlWithMeta, resolveTrackUrl, getImageUrlFromKey };
export default trackUrls;
