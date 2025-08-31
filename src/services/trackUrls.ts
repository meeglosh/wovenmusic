// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // R2 config
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_PRIVATE_BUCKET: string;         // where private objects live
  R2_PUBLIC_BUCKET?: string;         // optional if you only serve via CDN base
  R2_PUBLIC_BASE?: string;           // e.g. https://<your-public-bucket>.r2.cloudflarestorage.com OR custom domain
};

type TrackRow = {
  id: string;
  is_public: boolean;
  storage_type: string | null;   // 'r2' | 'supabase' | null
  storage_key: string | null;    // R2 key when storage_type = 'r2'
  storage_url: string | null;    // public R2 URL when appropriate
  file_url: string | null;       // legacy supabase public URL (compat)
  title?: string | null;
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildPublicR2Url(env: Env, key: string) {
  // Prefer explicit CDN/public base if provided
  const base = (env.R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (base) {
    // Keep path separators intact
    const safeKey = key.split("/").map(encodeURIComponent).join("/");
    return `${base}/${safeKey}`;
  }
  // Fallback to bucket canonical domain if desired (optional)
  // If you want to construct bucket domain, uncomment and set R2_PUBLIC_BUCKET:
  // if (env.R2_PUBLIC_BUCKET) {
  //   const safeKey = key.split("/").map(encodeURIComponent).join("/");
  //   return `https://${env.R2_PUBLIC_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${safeKey}`;
  // }
  return null;
}

async function signPrivateR2Url(env: Env, key: string, expiresInSeconds = 3600) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // recommended for R2
  });

  const command = new GetObjectCommand({
    Bucket: env.R2_PRIVATE_BUCKET,
    Key: key,
    // Optional: add inline content-disposition for nicer filename
    // ResponseContentDisposition: `inline; filename="${key.split('/').pop() || 'audio'}"`,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
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

    // 1) Fetch track info with service role (bypasses RLS safely on the server)
    const { data: track, error: tErr } = await supaService
      .from("tracks")
      .select("id,is_public,storage_type,storage_key,storage_url,file_url,title")
      .eq("id", trackId)
      .single();

    if (tErr || !track) return new Response("Not found", { status: 404 });

    // Helper to return public URL (no auth)
    const returnPublic = () => {
      // Prefer explicit storage_url if present
      if (track.storage_type === "r2" && track.storage_key) {
        const fromStorageUrl = track.storage_url && track.storage_url.trim().length > 0 ? track.storage_url : null;
        const built = buildPublicR2Url(env, track.storage_key);
        const url = fromStorageUrl || built;
        if (url) return json({ url });
      }
      // Legacy fallback (Supabase public)
      if (track.file_url) return json({ url: track.file_url });
      return new Response("Not found", { status: 404 });
    };

    // 2) If the track is PUBLIC → serve without requiring Authorization
    if (track.is_public) {
      return returnPublic();
    }

    // 3) Track is PRIVATE → require auth and access check
    // Try to read Bearer token; allow missing (we'll 401 below)
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    const { data: userRes, error: userErr } = await supaAnon.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = userRes.user.id;

    // 4) Check access with your RPC (service role)
    const { data: canAccess, error: rpcErr } = await supaService.rpc("has_track_access", {
      p_user: userId,
      p_track: trackId,
    });

    if (rpcErr) {
      console.error("has_track_access rpc error", rpcErr);
      return new Response("Server error", { status: 500 });
    }
    if (!canAccess) return new Response("Forbidden", { status: 403 });

    // 5) Resolve PRIVATE URL (signed) or legacy fallback
    if (track.storage_type === "r2" && track.storage_key) {
      const signed = await signPrivateR2Url(env, track.storage_key, 3600);
      return json({ url: signed.url, expiresAt: signed.expiresAt });
    }

    // Legacy fallback: if you still have file_url (public supabase) for a private track,
    // you probably DON'T want to expose it publicly; but if it is required for legacy playback:
    if (track.file_url) {
      return json({ url: track.file_url });
    }

    return new Response("Not found", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
