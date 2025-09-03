// /functions/api/image-upload.ts
// Cloudflare Pages Function for playlist image uploads + 300x300 thumb generation.

type Env = {
  IMAGES_PUBLIC: R2Bucket;               // R2 binding (public bucket)
  CDN_IMAGES_BASE?: string;              // e.g. https://images.wovenmusic.app
  VITE_CDN_IMAGES_BASE?: string;         // same as above (frontend-style)
  CORS_ORIGIN?: string;                  // e.g. https://wovenmusic.app
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;            // allow vite-style var
  SUPABASE_SERVICE_ROLE_KEY?: string;    // service key to update DB
};

const ok = (data: unknown, env: Env, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: corsHeaders(env, { "content-type": "application/json" }),
    ...init,
  });

const bad = (msg: string, env: Env, status = 400) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: corsHeaders(env, { "content-type": "application/json" }),
  });

function corsHeaders(env: Env, extra: Record<string, string> = {}) {
  const origin = env.CORS_ORIGIN || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers":
      "authorization, content-type, x-requested-with",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    ...extra,
  };
}

function cdnBase(env: Env): string {
  return (
    env.CDN_IMAGES_BASE ||
    env.VITE_CDN_IMAGES_BASE ||
    "https://images.wovenmusic.app"
  ).replace(/\/+$/, "");
}

function supabaseUrl(env: Env): string {
  return (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
}

function fileExtensionFromMime(mime: string): "jpg" | "png" | "webp" {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export const onRequestOptions: PagesFunction<Env> = async ({ env }) => {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Optional: basic Origin check
    const reqOrigin = request.headers.get("origin");
    if (env.CORS_ORIGIN && reqOrigin && reqOrigin !== env.CORS_ORIGIN) {
      return bad("CORS origin not allowed", env, 403);
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const entityType = String(form.get("entityType") || "");
    const playlistId = String(form.get("entityId") || "");

    if (!file || entityType !== "playlist" || !playlistId) {
      return bad("Missing file or invalid payload", env, 400);
    }

    // Save ORIGINAL
    const ext = fileExtensionFromMime(file.type || "image/jpeg");
    const baseName = `${Date.now()}-${crypto.randomUUID()}`;
    const dir = `images/playlists/${encodeURIComponent(playlistId)}`;
    const originalKey = `${dir}/${baseName}.${ext}`;
    await env.IMAGES_PUBLIC.put(originalKey, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    const cdn = cdnBase(env);
    const originalUrl = `${cdn}/${originalKey}`;

    // Generate THUMB (300x300 cover) using Cloudflare Image Resizing
    let thumbKey: string | null = null;
    let thumbUrl: string | null = null;
    try {
      const resizedResp = await fetch(originalUrl, {
        // Requires Image Resizing enabled on the images domain/zone
        cf: { image: { width: 300, height: 300, fit: "cover" } },
      });
      if (!resizedResp.ok) throw new Error(`Resize fetch failed: ${resizedResp.status}`);
      const thumbBuf = await resizedResp.arrayBuffer();

      thumbKey = `${dir}/thumb-${baseName}.${ext}`;
      await env.IMAGES_PUBLIC.put(thumbKey, thumbBuf, {
        httpMetadata: {
          contentType: file.type || "image/jpeg",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      thumbUrl = `${cdn}/${thumbKey}`;
    } catch (e) {
      // Non-fatal: proceed without thumb if resizing not available
      console.warn("Thumb generation failed:", e);
    }

    // Update Supabase row
    const sUrl = supabaseUrl(env);
    const sKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sUrl || !sKey) {
      console.warn("Supabase env missing; skipping DB update");
    } else {
      // Try with extended columns first; if it fails (unknown columns), retry minimal set.
      const bodyFull = {
        image_url: originalUrl,
        image_key: originalKey,
        cover_thumb_url: thumbUrl,
        cover_thumb_key: thumbKey,
      };
      const bodyMinimal = {
        image_url: originalUrl,
        image_key: originalKey,
      };

      const update = async (payload: Record<string, unknown>) =>
        fetch(`${sUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(playlistId)}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            apikey: sKey,
            authorization: `Bearer ${sKey}`,
            prefer: "return=minimal",
          },
          body: JSON.stringify(payload),
        });

      let resp = await update(bodyFull);
      if (!resp.ok) {
        // Fallback to minimal payload (schema might not have thumb columns)
        resp = await update(bodyMinimal);
        if (!resp.ok) {
          console.warn("Supabase update failed", await resp.text());
        }
      }
    }

    return ok(
      {
        image_url: originalUrl,
        image_key: originalKey,
        cover_thumb_url: thumbUrl,
        cover_thumb_key: thumbKey,
      },
      env
    );
  } catch (err: any) {
    return bad(err?.message || "Unexpected error", env, 500);
  }
};
