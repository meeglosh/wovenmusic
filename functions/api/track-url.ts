// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_BASE?: string; // optional public audio CDN, usually not used
  PUBLIC_BUCKET: R2Bucket;
  PRIVATE_BUCKET: R2Bucket;
};

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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Require bearer (private tracks)
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    // Verify user
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // Access check
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: hasAccess, error: rpcErr } = await supa.rpc("has_track_access", {
      p_user: userId,
      p_track: trackId,
    });
    if (rpcErr) {
      console.error("has_track_access error", rpcErr);
      return new Response("Server error", { status: 500 });
    }
    if (!hasAccess) return new Response("Forbidden", { status: 403 });

    // Be schema-agnostic: select *
    const { data: track, error } = await supa.from("tracks").select("*").eq("id", trackId).single();
    if (error || !track) return new Response("Not found", { status: 404 });

    const isPublic = pickBool(track, ["is_public", "public"], false);

    // Key-first (R2-style)
    const key =
      pickFirst(track, ["storage_key", "audio_storage_key", "file_key", "path", "object_key"]) || null;

    const storageType = pickFirst(track, ["storage_type", "audio_storage_type"]) || null;

    if (key && (storageType === "r2" || !/^https?:\/\//i.test(key))) {
      // If you set CDN_BASE for public audio, you can serve it directly
      if (isPublic && env.CDN_BASE) {
        const cdn = env.CDN_BASE.replace(/\/+$/, "");
        return json({ url: `${cdn}/${key}` });
      }
      // Private (or no CDN): proxy through our Range-supporting stream
      const origin = `${url.protocol}//${url.host}`;
      return json({ url: `${origin}/api/track-stream?id=${encodeURIComponent(trackId)}` });
    }

    // URL fallbacks for legacy rows
    const directUrl =
      pickFirst(track, ["storage_url", "file_url", "audio_url", "url"]) || null;
    if (directUrl) return json({ url: directUrl });

    return new Response("No storage handle", { status: 404 });
  } catch (e) {
    console.error("track-url error", e);
    return new Response("Server error", { status: 500 });
  }
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
