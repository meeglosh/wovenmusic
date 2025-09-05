// functions/api/track-stream.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // R2 bucket bindings (Pages → Settings → Functions → Bindings)
  AUDIO_PRIVATE: R2Bucket;
  AUDIO_PUBLIC: R2Bucket;
};

type Track = {
  id: string;
  is_public: boolean;
  storage_type: string | null;   // 'r2' | ...
  storage_key: string | null;
  storage_url?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  created_at?: string | null;
};

const EXT_CANDIDATES = [".mp3", ".m4a", ".aac", ".wav", ".aif", ".aiff", ".flac", ".ogg", ".wma"];

function guessMimeFromExt(key: string): string | undefined {
  const k = key.toLowerCase();
  if (k.endsWith(".mp3")) return "audio/mpeg";
  if (k.endsWith(".m4a")) return "audio/mp4";
  if (k.endsWith(".aac")) return "audio/aac";
  if (k.endsWith(".wav")) return "audio/wav";
  if (k.endsWith(".aif") || k.endsWith(".aiff")) return "audio/aiff";
  if (k.endsWith(".flac")) return "audio/flac";
  if (k.endsWith(".ogg")) return "audio/ogg";
  if (k.endsWith(".wma")) return "audio/x-ms-wma";
  return undefined;
}

function cleanKeyLike(k?: string | null): string | null {
  if (!k) return null;
  const trimmed = k.trim();
  if (!trimmed) return null;
  // If this looks like a URL, peel off pathname; otherwise treat as key
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/^\/+/, "");
    return path || null;
  } catch {
    // not a URL; normalize leading slash
    return trimmed.replace(/^\/+/, "");
  }
}

// Parse "Range: bytes=start-end" into an R2Range
function parseRangeHeader(rangeHeader: string | null): R2Range | undefined {
  if (!rangeHeader) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return undefined;
  const [, startStr, endStr] = m;

  if (startStr && endStr) {
    const start = Number(startStr);
    const end = Number(endStr);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return { offset: start, length: end - start + 1 };
    }
    return undefined;
  }
  if (startStr && !endStr) {
    const start = Number(startStr);
    return Number.isFinite(start) ? { offset: start } : undefined;
  }
  if (!startStr && endStr) {
    const lastN = Number(endStr);
    return Number.isFinite(lastN) && lastN > 0 ? { suffix: lastN } : undefined;
  }
  return undefined;
}

function ymdFromCreatedAt(created_at?: string | null): { y: string; m: string; d: string } | null {
  if (!created_at) return null;
  const t = Date.parse(created_at);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return { y, m, d: day };
}

function buildKeyCandidates(track: Track): string[] {
  const out: string[] = [];
  const add = (k?: string | null) => {
    const c = cleanKeyLike(k);
    if (c && !out.includes(c)) out.push(c);
  };

  // 1) Direct fields
  add(track.storage_key);
  add(track.storage_url);
  add(track.file_url);

  // 2) Legacy common patterns
  for (const ext of EXT_CANDIDATES) add(`tracks/${track.id}${ext}`);
  for (const ext of EXT_CANDIDATES) add(`${track.id}${ext}`);

  // 3) Date-based folders if available (both with and without "tracks/")
  const ymd = ymdFromCreatedAt(track.created_at);
  if (ymd) {
    const { y, m, d } = ymd;
    for (const ext of EXT_CANDIDATES) {
      add(`${y}/${m}/${d}/${track.id}${ext}`);
      add(`tracks/${y}/${m}/${d}/${track.id}${ext}`);
      add(`${y}/${m}/${track.id}${ext}`);
      add(`tracks/${y}/${m}/${track.id}${ext}`);
    }
  }

  return out;
}

async function findExistingKey(bucket: R2Bucket, candidates: string[]): Promise<string | null> {
  for (const key of candidates) {
    try {
      const head = await bucket.head(key);
      if (head) return key;
    } catch {
      // ignore and continue
    }
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Clients can pass token via query (?token=) for <audio> tag, or Authorization header
    const headerAuth = request.headers.get("authorization") || "";
    const bearer = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7) : null;
    const token = bearer || url.searchParams.get("token") || "";

    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const supaService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Load track metadata (service role: no RLS surprises)
    const { data: track, error } = await supaService
      .from("tracks")
      .select("id, is_public, storage_type, storage_key, storage_url, file_url, mime_type, created_at")
      .eq("id", trackId)
      .single<Track>();

    if (error || !track) return new Response("Not found", { status: 404 });

    // Choose bucket by visibility
    const bucket: R2Bucket = track.is_public ? env.AUDIO_PUBLIC : env.AUDIO_PRIVATE;

    // PRIVATE: validate token with Supabase
    if (!track.is_public) {
      if (!token) return new Response("Unauthorized", { status: 401 });
      const { data: userRes, error: userErr } = await supaAnon.auth.getUser(token);
      const userId = userRes?.user?.id;
      if (userErr || !userId) return new Response("Unauthorized", { status: 401 });

      // Optional: Add stricter ACL checks here if needed (e.g., playlist membership)
    }

    // Resolve a working object key
    const candidates = buildKeyCandidates(track);
    const resolvedKey = await findExistingKey(bucket, candidates);

    if (!resolvedKey) {
      return new Response(
        JSON.stringify({ error: "File not found", tried: candidates }, null, 2),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // If we found a better key than what's in DB, update for self-healing
    if (resolvedKey !== track.storage_key) {
      try {
        await supaService
          .from("tracks")
          .update({ storage_key: resolvedKey, storage_type: "r2" })
          .eq("id", track.id);
      } catch {
        // non-fatal
      }
    }

    // Handle Range requests for seeking
    const rangeHeader = request.headers.get("Range");
    const r2Range = parseRangeHeader(rangeHeader);

    const obj = await bucket.get(resolvedKey, r2Range ? { range: r2Range } : undefined);
    if (!obj) {
      // Should not happen because HEAD succeeded, but handle anyway
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");
    const ct =
      track.mime_type ||
      obj.httpMetadata?.contentType ||
      guessMimeFromExt(resolvedKey) ||
      "application/octet-stream";
    headers.set("Content-Type", ct);
    headers.set(
      "Cache-Control",
      track.is_public ? "public, max-age=86400, immutable" : "private, max-age=60"
    );
    headers.set("Cross-Origin-Resource-Policy", "same-origin");

    if (obj.range) {
      const { offset, length } = obj.range;
      const end = offset + length - 1;
      headers.set("Content-Range", `bytes ${offset}-${end}/${obj.size}`);
      headers.set("Content-Length", String(length));
      return new Response(obj.body, { status: 206, headers });
    }

    headers.set("Content-Length", String(obj.size));
    return new Response(obj.body, { status: 200, headers });
  } catch (e) {
    console.error("track-stream error", e);
    return new Response("Server error", { status: 500 });
  }
};
