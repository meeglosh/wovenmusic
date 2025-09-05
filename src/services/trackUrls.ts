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

  // Try Supabase Edge Function first - it should return the signed URL directly
  if (pathWithQuery.startsWith('track-url')) {
    try {
      const trackId = new URLSearchParams(pathWithQuery.split('?')[1]).get('id');
      if (trackId) {
        // Use the correct HTTP method (GET) for the edge function
        const response = await fetch(`https://woakvdhlpludrttjixxq.supabase.co/functions/v1/track-url?id=${encodeURIComponent(trackId)}`, {
          method: 'GET',
          headers: session?.access_token ? { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          } : { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Supabase Edge Function response:', data);
          if (data?.ok && data?.url) return data;
        } else {
          const errorText = await response.text();
          console.warn(`Supabase Edge Function returned ${response.status}: ${errorText}`);
        }
      }
    } catch (e) {
      console.warn('Supabase Edge Function failed, trying other endpoints:', e);
    }
  }

  // Final fallback: try Cloudflare Pages Functions (if available)
  try {
    const trackId = new URLSearchParams(pathWithQuery.split('?')[1]).get('id');
    if (trackId) {
      const cfResponse = await fetch(`${BASE}/api/track-url?id=${encodeURIComponent(trackId)}`, {
        headers
      });
      
      if (cfResponse.ok) {
        const data = await cfResponse.json();
        console.log('Cloudflare Pages Function response:', data);
        if (data?.url) return data;
      }
    }
  } catch (e) {
    console.warn('Cloudflare Pages Function failed:', e);
  }

  throw new Error("Unable to resolve track URL - all endpoints failed");
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
