// src/services/r2StorageService.ts

export interface R2UploadResult {
  storageKey: string;
  bucketName: string;
  publicUrl?: string;
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

const RAW_BASE =
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";
const BASE = RAW_BASE.replace(/\/+$/, "");

async function getJsonWithFallback(pathWithQuery: string): Promise<BackendTrackUrlResponse> {
  const candidates = [`${BASE}/api/${pathWithQuery}`, `${BASE}/${pathWithQuery}`];

  let lastText = "";
  for (const url of candidates) {
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) return (await res.json()) as BackendTrackUrlResponse;
    lastText = await res.text().catch(() => "");
  }
  throw new Error(`track-url failed: ${lastText || "unexpected error"}`);
}

/**
 * Service to interact with R2 via your backend.
 * - Playback URL resolution (+ migration helpers if you need them).
 */
class R2StorageService {
  async getTrackUrl(trackId: string): Promise<TrackUrlResult> {
    const data = await getJsonWithFallback(`track-url?id=${encodeURIComponent(trackId)}`);
    if (!data?.url) {
      throw new Error(data?.error || "No URL returned for track");
    }
    return { fileUrl: data.url, expiresAt: data.expiresAt };
  }

  needsMigration(track: any): boolean {
    return track?.storage_type !== "r2" && !!track?.file_url && !track?.storage_key;
  }

  async migrateTrack(track: any): Promise<R2UploadResult> {
    if (!track?.file_url) throw new Error("No file URL to migrate");

    const resp = await fetch(track.file_url);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Failed to download file (${resp.status}): ${txt || resp.statusText}`);
    }
    const blob = await resp.blob();

    const form = new FormData();
    const safeName =
      (track?.title ? String(track.title) : "audio").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
      "audio";
    form.append("audio", new File([blob], `${safeName}.mp3`, { type: blob.type || "audio/mpeg" }));
    form.append("quality", "standard");
    form.append("migration", "true");

    const candidates = [`${BASE}/api/process-audio`, `${BASE}/process-audio`];
    let lastText = "";
    for (const url of candidates) {
      const res = await fetch(url, { method: "POST", body: form, credentials: "include" });
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
      }
      lastText = await res.text().catch(() => "");
    }
    throw new Error(`Migration failed on backend: ${lastText || "unexpected error"}`);
  }
}

export const r2StorageService = new R2StorageService();
