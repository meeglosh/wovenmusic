// src/services/r2StorageService.ts

export interface R2UploadResult {
  storageKey: string;
  bucketName: string;
  publicUrl?: string; // Present only if the object is publicly readable
}

export interface TrackUrlResult {
  fileUrl: string;     // Playable URL (public or time-limited signed)
  expiresAt?: string;  // ISO string if signed
}

type BackendTrackUrlResponse = {
  url?: string;
  expiresAt?: string;
  error?: string;
};

type BackendProcessAudioResponse = {
  storage_key?: string;
  storage_bucket?: string;
  url?: string; // public URL if bucket/object is public
  error?: string;
};

const RAW_BASE =
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";

// Ensure no trailing slash
const BASE = RAW_BASE.replace(/\/+$/, "");

/**
 * Service to interact with R2 via your backend.
 * - New audio ingestion should go through /api/process-audio (see importTranscodingService).
 * - This service focuses on: playback URL resolution & migrating legacy (Supabase) objects to R2.
 */
class R2StorageService {
  /**
   * Ask the backend for a playable URL for a given track id.
   * The backend decides whether to return a public R2 URL or a time-limited signed URL.
   */
  async getTrackUrl(trackId: string): Promise{TrackUrlResult} {
    const url = `${BASE}/api/track-url?id=${encodeURIComponent(trackId)}`;

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      // Try to surface any backend text for easier debugging
      const txt = await res.text().catch(() => "");
      throw new Error(`Failed to get track URL (${res.status}): ${txt || res.statusText}`);
    }

    const data: BackendTrackUrlResponse = await res.json();
    if (!data?.url) {
      throw new Error(data?.error || "No URL returned for track");
    }

    return { fileUrl: data.url, expiresAt: data.expiresAt };
  }

  /**
   * Convenience: If you already have the track row, figure out the best immediate URL,
   * or fall back to asking the backend (for private R2).
   * - Public R2: use storage_url directly
   * - Private R2: call getTrackUrl(track.id) for a signed URL
   * - Legacy Supabase: use file_url (caller may still choose to migrate)
   */
  async getBestUrlForTrack(track: any): Promise<TrackUrlResult> {
    // Public R2 object
    if (track?.storage_type === "r2" && track?.is_public && track?.storage_url) {
      return { fileUrl: track.storage_url };
    }
    // Private R2 object (needs signing)
    if (track?.storage_type === "r2" && track?.storage_key && !track?.is_public) {
      return this.getTrackUrl(track.id);
    }
    // Legacy Supabase fallback (direct public URL)
    if (track?.file_url) {
      return { fileUrl: track.file_url };
    }

    throw new Error("No resolvable URL for this track");
  }

  /**
   * A simple check: track still lives in Supabase (legacy) if:
   * - storage_type !== 'r2' (or missing)
   * - and there is a legacy file_url
   */
  needsMigration(track: any): boolean {
    return track?.storage_type !== "r2" && !!track?.file_url;
  }

  /**
   * Migrates a legacy Supabase track into R2 by downloading then re-uploading through the backend.
   * Uses /api/process-audio for consistent handling (normalizes/encodes & stores in R2).
   * Returns storage details (and public URL if applicable).
   */
  async migrateTrack(track: any): Promise<R2UploadResult> {
    if (!track?.file_url) {
      throw new Error("No legacy file_url to migrate");
    }

    // If it's already in R2, don't migrate again
    if (track?.storage_type === "r2") {
      throw new Error("Track already resides in R2");
    }

    try {
      // 1) Download from legacy Supabase URL
      const resp = await fetch(track.file_url);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`Failed to download legacy file (${resp.status}): ${txt || resp.statusText}`);
      }
      const blob = await resp.blob();

      // 2) Send through backend for R2 storage
      const form = new FormData();
      // Keep original extension if possible; default to .mp3 if unknown
      const safeName =
        (track?.title ? String(track.title) : "audio")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 120) || "audio";
      const ext = /\.([a-z0-9]{2,5})$/i.test(safeName) ? "" : ".mp3";

      form.append("audio", new File([blob], `${safeName}${ext}`, { type: blob.type || "audio/mpeg" }));
      // For migration, keep a balanced/default quality. Frontend "quality" here is just a hint;
      // the backend can ignore or map it appropriately.
      form.append("quality", "standard");
      form.append("migration", "true");

      const res = await fetch(`${BASE}/api/process-audio`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Migration failed on backend (${res.status}): ${txt}`);
      }

      const data: BackendProcessAudioResponse = await res.json();
      if (!data?.storage_key || !data?.storage_bucket) {
        throw new Error(data?.error || "Backend did not return R2 storage details");
      }

      return {
        storageKey: data.storage_key,
        bucketName: data.storage_bucket,
        publicUrl: data.url,
      };
    } catch (err) {
      console.error("Migration failed:", err);
      throw err;
    }
  }
}

export const r2StorageService = new R2StorageService();
