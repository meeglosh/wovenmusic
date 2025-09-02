// functions/api/track-stream.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // R2 bucket bindings (configure in Cloudflare Pages → Settings → Functions → R2 bindings)
  AUDIO_PRIVATE: R2Bucket;
  AUDIO_PUBLIC: R2Bucket;
};

// ---- helpers ----
function pickFirst<T extends object>(o: T | null | undefined, keys: string[]): string | null {
  if (!o) return null;
  for (const k of keys) {
    const v = (o as any)[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
function pickBool<T extends object>(o: T | null | undefined, keys: string[], def = false): boolean {
  if (!o) return def;
  for (const k of keys) {
    const v = (o as any)[k];
    if (typeof v === "boolean") return v;
    if (v === 0 || v === 1) return !!v;
  }
  return def;
}
function guessMimeFromExt(key: string): string | undefined {
  const k = key.toLowerCase();
  if (k.endsWith(".mp3")) return "audio/mpeg";
  if (k.endsWith(".m4a") || k.endsWith(".mp4")) return "audio/mp4";
  if (k.endsWith(".aac")) return "audio/aac";
  if (k.endsWith(".wav")) return "audio/wav";
  if (k.endsWith(".aif") || k.endsWith(".aiff")) return "audio/aiff";
  if (k.endsWith(".flac")) return "audio/flac";
  if (k.endsWith(".ogg")) return "audio/ogg";
  if (k.endsWith(".wma")) return "audio/x-ms-wma";
  return undefined;
}
// Parse "Range: bytes=start-end" into an R2 range option
function parseRangeHeader(rangeHeader: string | null): R2Range | undefined {
  if (!rangeHeader) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return undefined;
  const startStr = m[1];
  const endStr = m[2];
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
    if (Number.isFinite(start)) return { offset: start };
    return undefined;
  }
  if (!startStr && endStr) {
    const lastN = Number(endStr);
    if (Number.isFinite(lastN) && lastN > 0) return { suffix: lastN };
  }
  return undefined;
}

// ---- handler ----
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const supaService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch track (schema-agnostic)
    const { data: track, error } = await supaService.from("tracks").select("*").eq("id", trackId).single();
    if (error || !track) return new Response("Not found", { status: 404 });

    const isPublic = pickBool(track, ["is_public", "public"], false);
    const key =
      pickFirst(track, ["storage_key", "audio_storage_key", "file_key", "path", "object_key"]) || null;

    // No key? nothing to stream.
    if (!key) return new Response("No storage handle", { status: 404 });

    // Choose bucket
    const bucket: R2Bucket = isPublic ? env.AUDIO_PUBLIC : env.AUDIO_PRIVATE;

    // Private tracks: require auth + ACL
    if (!isPublic) {
      const auth = request.headers.get("authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
      if (!token) return new Response("Unauthorized", { status: 401 });

      const { data: userRes, error: userErr } = await supaAnon.auth.getUser(token);
      const userId = userRes?.user?.id;
      if (userErr || !userId) return new Response("Unauthorized", { status: 401 });

      const { data: can, error: rpcErr } = await supaService.rpc("has_track_access", {
        p_user: userId,
        p_track: trackId,
      });
      if (rpcErr) {
        console.error("has_track_access error", rpcErr);
        return new Response("Server error", { status: 500 });
      }
      if (!can) return new Response("Forbidden", { status: 403 });
    }

    // Range support
    const rangeHeader = request.headers.get("Range");
    const r2Range = parseRangeHeader(rangeHeader);

    const obj = await bucket.get(key, r2Range ? { range: r2Range } : undefined);
    if (!obj) return new Response("Not found", { status: 404 });

    // Headers
    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");

    // Content-Type: DB hints → R2 → extension
    const dbMime =
      pickFirst(track, ["mime_type", "mimetype", "content_type", "mime"]) || undefined;
    const ct = dbMime || obj.httpMetadata?.contentType || guessMimeFromExt(key) || "application/octet-stream";
    headers.set("Content-Type", ct);

    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
    if (obj.uploaded) headers.set("Last-Modified", new Date(obj.uploaded).toUTCString());

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
