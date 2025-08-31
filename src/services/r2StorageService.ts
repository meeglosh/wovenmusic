// src/services/r2StorageService.ts

export interface R2UploadResult {
  storageKey: string;
  bucketName: string;
  publicUrl?: string; // only for public bucket objects
}

export interface TrackUrlResult {
  fileUrl: string;
  expiresAt?: string;
}

type BackendTrackUrlResponse = {
  url?: string;
  expiresAt?: string;
  error?: string;
};

/**
 * Resolve the API base:
 * - If VITE_APP_API_BASE is "self" or empty -> use relative URLs ("/api/..."), which hit your Cloudflare Pages Functions.
 * - Otherwise use the explicit base, trimming any trailing slashes.
 */
const RAW = (import.meta as any)?.env?.VITE_APP_API_BASE ?? "";
const APP_BASE = typeof RAW === "string" ? RAW.trim() : "";
const BASE = !APP_BASE || APP_BASE === "self" ? "" : APP_BASE.replace(/\/+$/, "");

/** Build a full URL for an API path (expects a leading slash). */
function apiUrl(path: string) {
  return `${BASE}${path}`;
}

/**
 * Service to interact with your backend (Pages Functions) for:
 * - Playback URL resolution
 * - Optional migration of legacy files into R2 (uses your own API, not the old transcode server)
 */
class R2StorageService {
  /**
   * Ask your Pages Function for a playable (possibly signed) URL for a track.
   * Endpoint implemented in functions/api/track-url.ts
   */
  async getTrackUrl(trackId: string): Promise<TrackUrlResult> {
    const url = apiUrl(`/api/track-url?id=${encodeURIComponent(trackId)}`);
    const res = await fetch(url, { credentials: "include" });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to get track URL (${res.status}): ${text || res.statusText}`);
    }

    const data = (await res.json()) as BackendTrackUrlResponse;
    if (!data?.url) {
      throw new Error(data?.error || "No URL returned for track");
    }
    return { fileUrl: data.url, expiresAt: data.expiresAt };
  }

  /** Detect if a Supabase-stored legacy track needs migrating to R2. */
  needsMigration(track: any): boolean {
    return track?.storage_type !== "r2" && !!track?.file_url && !track?.storage_key;
  }

  /**
   * OPTIONAL: Migrate a legacy file (e.g., Supabase storage) to R2 via your Pages Function.
   * This POSTs the blob to your backend, which stores it in R2 and returns a storage handle.
   * Tries /api/process-upload first, then /api/process-audio (if you kept that name).
   */
  async migrateTrack(track: any): Promise<R2UploadResult> {
    if (!track?.file_url) throw new Error("No file URL to migrate");

    // Download the existing file
    const resp = await fetch(track.file_url);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Failed to download file (${resp.status}): ${txt || resp.statusText}`);
    }
    const blob = await resp.blob();

    // Prepare form data for the backend
    const safeName =
      (track?.title ? String(track.title) : "audio")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 120) || "audio";

    const form = new FormData();
    form.append("audio", new File([blob], `${safeName}.mp3`, { type: blob.type || "audio/mpeg" }));
    form.append("quality", "standard");
    form.append("migration", "true");

    // Prefer your /api/process-upload; fall back to /api/process-audio if present
    const endpoints = [apiUrl("/api/process-upload"), apiUrl("/api/process-audio")];

    let lastText = "";
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            storage_key?: string;
            storage_bucket?: string;
            url?: string;
          };
          if (!data?.storage_key || !data?.storage_bucket) {
            throw new Error("Backend did not return R2 storage details");
          }
          return {
            storageKey: data.storage_key,
            bucketName: data.storage_bucket,
            publicUrl: data.url,
          };
        } else {
          lastText = await res.text().catch(() => "");
        }
      } catch (e: any) {
        lastText = String(e?.message || e) || lastText;
      }
    }

    throw new Error(`Migration failed on backend: ${lastText || "unexpected error"}`);
  }
}

export const r2StorageService = new R2StorageService();
