// src/services/trackUrls.ts

// Base URL for your backend API.
// Prefer VITE_APP_API_BASE if you add a full app API service;
// otherwise fall back to the transcode-server directly.
const APP_API_BASE =
  (import.meta as any)?.env?.VITE_APP_API_BASE ||
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";

/**
 * Generate the endpoint URL for track URL lookup.
 */
function trackUrlEndpoint(id: string): string {
  return `${APP_API_BASE}/api/track-url?id=${encodeURIComponent(id)}`;
}

interface TrackUrlResponse {
  ok: boolean;
  url?: string;
  error?: string;
  source?: "r2" | "supabase";
  expiresAt?: string;
}

/**
 * Resolve the latest playback URL for a track from the backend.
 *
 * Backend should:
 *  - If storage_type === 'r2' → return R2 URL (public or presigned)
 *  - Else (legacy Supabase)   → return Supabase public URL
 *
 * Expected response shape:
 *   { ok: true, url: string, source: 'r2' | 'supabase', expiresAt?: string }
 */
export async function resolveTrackUrl(trackId: string): Promise<string> {
  const endpoint = trackUrlEndpoint(trackId);

  try {
    const res = await fetch(endpoint, { credentials: "include" });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`track-url failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as TrackUrlResponse;

    if (!json?.ok || !json?.url) {
      throw new Error(json?.error || "Invalid response from track-url");
    }

    return String(json.url);
  } catch (error) {
    console.error("Error resolving track URL:", error);
    throw new Error(
      `Failed to resolve track URL: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
