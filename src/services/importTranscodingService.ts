// src/services/importTranscodingService.ts
// Unifies upload + transcode via backend "process-audio" endpoint,
// with an /api/* -> /* fallback so it works with either routing style.

const RAW_BASE =
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";
const BASE = RAW_BASE.replace(/\/+$/, "");

type ProcessAudioResponse = {
  url?: string;               // public URL (if public bucket/object)
  publicUrl?: string;         // sometimes returned as publicUrl
  originalFilename?: string;
  storage_key?: string;
  storage_bucket?: string;
  storage_url?: string;       // public url (duplicate of url in some backends)
  error?: string;
};

async function postWithFallback(
  endpoint: string,
  body: FormData
): Promise<ProcessAudioResponse> {
  // Try /api/<endpoint> first, then fallback to /<endpoint>
  const candidates = [`${BASE}/api/${endpoint}`, `${BASE}/${endpoint}`];

  let lastText = "";
  for (const url of candidates) {
    const res = await fetch(url, { method: "POST", body, credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as ProcessAudioResponse;
      return data;
    }
    lastText = await res.text().catch(() => "");
    // try next candidate if any
  }
  throw new Error(`${endpoint} failed: ${lastText || "unexpected error"}`);
}

const needsTxExt = new Set([".wav", ".aif", ".aiff"]);

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? `.${m[1].toLowerCase()}` : "";
}

export const importTranscodingService = {
  // Only uncompressed formats should trigger transcoding
  needsTranscoding(filename: string): boolean {
    return needsTxExt.has(extOf(filename));
  },

  /**
   * Send a FILE or a SOURCE URL to the backend for processing & storage in R2.
   * The backend decides whether to transcode or just store as-is.
   */
  async transcodeAndStore(
    source: File | string,
    originalName: string,
    outputFormat: "mp3" | "aac" = "mp3"
  ): Promise<{
    publicUrl?: string;
    storage_key?: string;
    storage_bucket?: string;
    storage_url?: string;
    originalFilename?: string;
  }> {
    const form = new FormData();
    form.append("fileName", originalName);
    form.append("outputFormat", outputFormat);
    // If you want fixed bitrate: form.append("bitrate", "320k");

    if (typeof source === "string") {
      // Let the backend fetch the remote file (used by Dropbox imports)
      form.append("url", source);
    } else {
      // Direct file upload (used by Upload modal)
      form.append("audio", source, originalName);
    }

    const data = await postWithFallback("process-audio", form);

    return {
      publicUrl: data.publicUrl || data.url || data.storage_url,
      storage_key: data.storage_key,
      storage_bucket: data.storage_bucket,
      storage_url: data.storage_url || data.url,
      originalFilename: data.originalFilename,
    };
  },

  /**
   * Alias for clarity when the caller knows it's a direct upload.
   * Uses the same endpoint as transcodeAndStore.
   */
  async processUpload(
    file: File,
    fileName: string,
    outputFormat: "mp3" | "aac" = "mp3"
  ) {
    return this.transcodeAndStore(file, fileName, outputFormat);
  },
};
