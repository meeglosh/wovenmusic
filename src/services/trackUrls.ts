// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

// NOTE: This function does not touch AWS SDKs. It relies on:
// - R2 bucket bindings (AUDIO_PUBLIC / AUDIO_PRIVATE) configured in Cloudflare Pages
// - Optional CDN_BASE (your public R2 hostname) for public files
// - A separate /api/track-stream function that reads from R2 and streams bytes

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Optional public CDN base for your public R2 bucket
  // e.g. "https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com"
  CDN_BASE?: string;

  // R2 bucket bindings (already configured in your Pages project)
  AUDIO_PUBLIC: R2Bucket;
  AUDIO_PRIVATE: R2Bucket;
};

type TrackRow = {
  id: string;
  is_public: boolean;
  storage_type: string | null; // 'r2' | 'supabase' | null
  storage_key: string | null;  // R2 key when storage_type = 'r2'
  storage_url: string | null;  // legacy/public url (optional)
  file_url: string | null;     // legacy supabase public url
  title?: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildPublicR2Url(cdnBase: string | undefined, key: string): string | null {
  if (!cdnBase) return null;
  const base = cdnBase.replace(/\/+$/, "");
  // Encode each path segment but keep slashes
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/${safeKey}`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Supabase clients
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const supaService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1) Fetch track info (service role: safe on server)
    const { data: track, error: tErr } = await supaService
      .from("tracks")
      .select("id,is_public,storage_type,storage_key,storage_url,file_url,title")
      .eq("id", trackId)
      .single();

    if (tErr || !track) return new Response("Not found", { status: 404 });

    // Helper: return a browser-usable URL for PUBLIC items
    const respondPublic = () => {
      // Prefer R2 public key via CDN if available
      if (track.storage_type === "r2" && track.storage_key) {
        const cdnUrl =
          buildPublicR2Url(env.CDN_BASE, track.storage_key) ||
          null;

        if (cdnUrl) return json({ url: cdnUrl });
        // If no CDN base is configured, fall back to our proxy stream
        const origin = `${url.protocol}//${url.host}`;
        return json({ url: `${origin}/api/track-stream?id=${encodeURIComponent(trackId)}` });
      }

      // Legacy Supabase public URL (if still present)
      if (track.file_url) return json({ url: track.file_url });

      return new Response("Not found", { status: 404 });
    };

    // 2) PUBLIC track → no auth required
    if (track.is_public) {
      return respondPublic();
    }

    // 3) PRIVATE track → require Supabase bearer + access check
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    const { data: userRes, error: userErr } = await supaAnon.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return new Response("Unauthorized", { status: 401 });

    const userId = userRes.user.id;

    // 4) Call your access-check RPC (service role)
    const { data: canAccess, error: rpcErr } = await supaService.rpc("has_track_access", {
      p_user: userId,
      p_track: trackId,
    });

    if (rpcErr) {
      console.error("has_track_access rpc error", rpcErr);
      return new Response("Server error", { status: 500 });
    }
    if (!canAccess) return new Response("Forbidden", { status: 403 });

    // 5) For private items, return our proxy stream endpoint
    //    (The /api/track-stream function will read from AUDIO_PRIVATE and stream bytes.)
    if (track.storage_type === "r2" && track.storage_key) {
      const origin = `${url.protocol}//${url.host}`;
      return json({ url: `${origin}/api/track-stream?id=${encodeURIComponent(trackId)}` });
    }

    // Legacy private fallback (discouraged, but supported if you still have it)
    if (track.file_url) {
      return json({ url: track.file_url });
    }

    return new Response("Not found", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
