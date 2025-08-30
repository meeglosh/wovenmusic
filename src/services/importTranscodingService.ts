// src/services/importTranscodingService.ts

export interface TranscodeResult {
  /** Ready-to-play URL (public or presigned if private bucket). */
  url: string;
  /** Always "r2" for new imports. */
  storage_type: 'r2';
  /** R2 bucket name. */
  storage_bucket: string;
  /** R2 object key, e.g. "tracks/<uuid>.mp3" */
  storage_key: string;
  /** MIME type, e.g. "audio/mpeg" | "audio/mp4" */
  content_type: string;
  /** Original filename (no extension). */
  originalFilename?: string;
  /** Whether a transcode actually happened on the backend. */
  transcoded?: boolean;
  /** Quality used: "standard" (MP3 320) or "high" (AAC 320). */
  quality?: 'standard' | 'high';
}

const BASE =
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  'https://transcode-server.onrender.com';

const AUDIO_PROCESS_ENDPOINT = `${BASE}/api/process-audio`;

async function handleResponse(res: Response): Promise<TranscodeResult> {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`process-audio failed (${res.status}): ${txt}`);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('process-audio returned non-JSON');
  }
  // Expected shape from backend:
  // { ok: true, url, storage_type:'r2', storage_bucket, storage_key, content_type, originalFilename, transcoded, quality }
  if (!data?.ok || !data?.url || !data?.storage_key || data.storage_type !== 'r2') {
    throw new Error(
      data?.error || 'Invalid response from process-audio (missing ok/url/storage_key or storage_type!==r2)'
    );
  }
  return {
    url: data.url,
    storage_type: 'r2',
    storage_bucket: data.storage_bucket,
    storage_key: data.storage_key,
    content_type: data.content_type,
    originalFilename: data.originalFilename,
    transcoded: data.transcoded,
    quality: data.quality,
  };
}

export class ImportTranscodingService {
  /**
   * Import from a remote URL (e.g., Dropbox temp link) and store in R2.
   * WAV/AIFF are transcoded; MP3/AAC uploaded as-is.
   * @param quality "standard" -> MP3 320, "high" -> AAC 320
   */
  async importFromUrl(
    audioUrl: string,
    fileName: string,
    quality: 'standard' | 'high' = 'standard',
    retries = 3
  ): Promise<TranscodeResult> {
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(AUDIO_PROCESS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ audioUrl, fileName, quality }),
        });
        return await handleResponse(res);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }
    throw lastErr || new Error('All import attempts failed');
  }

  /**
   * Upload a local File (user upload) and store in R2.
   * WAV/AIFF are transcoded; MP3/AAC uploaded as-is.
   * @param quality "standard" -> MP3 320, "high" -> AAC 320
   */
  async uploadFile(
    file: File,
    quality: 'standard' | 'high' = 'standard',
    retries = 3
  ): Promise<TranscodeResult> {
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const form = new FormData();
        form.append('audio', file, file.name);
        form.append('quality', quality);
        const res = await fetch(AUDIO_PROCESS_ENDPOINT, {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
        return await handleResponse(res);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }
    throw lastErr || new Error('All upload attempts failed');
  }

  /** Frontend-side helper for gating transcode UI. */
  needsTranscoding(filePath: string): boolean {
    const ext = (filePath || '').toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();
