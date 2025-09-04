// Cloudflare Pages Function: POST /api/image-upload
// - Accepts multipart/form-data with fields: file, entityType ("playlist" | "profile"), entityId
// - Stores original in R2 (IMAGES_PUBLIC)
// - Generates a 300x300 JPEG thumb via Cloudflare Image Resizing and stores it
// - Updates Supabase row (playlists or profiles) with image_url (and keeps working even if thumb copy fails)
// - CORS/OPTIONS friendly

import { createClient } from "@supabase/supabase-js";

interface Env {
  IMAGES_PUBLIC: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_CDN_IMAGES_BASE?: string; // e.g. https://images.wovenmusic.app
}

const corsHeaders = (origin?: string) => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  ...(origin ? { "access-control-allow-origin": origin } : {}),
});

const json = (status: number, body: unknown, origin?: string) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("origin") ?? "*";
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("origin") ?? undefined;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "Invalid multipart/form-data" }, origin);
  }

  const file = form.get("file") as File | null;
  const entityType = String(form.get("entityType") || "playlist");
  const entityId = String(form.get("entityId") || "");

  if (!file) return json(400, { error: "file missing" }, origin);
  if (!entityId) return json(400, { error: "entityId missing" }, origin);
  if (entityType !== "playlist" && entityType !== "profile") {
    return json(400, { error: "unsupported entityType" }, origin);
  }

  const cdnBase = (env.VITE_CDN_IMAGES_BASE || "https://images.wovenmusic.app").replace(/\/+$/, "");
  const folder = entityType === "playlist" ? "images/playlists" : "images/profiles";
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const base = `${folder}/${entityId}`;
  const originalKey = `${base}.${ext}`;
  const thumbKey = `${folder}/thumb-${entityId}.jpg`;

  // Save original
  await env.IMAGES_PUBLIC.put(originalKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  // Best-effort: generate 300x300 thumb using Cloudflare Image Resizing
  try {
    const originalUrl = `${cdnBase}/${originalKey}`;
    const resized = await fetch(originalUrl, {
      // @ts-ignore - Workers image API
      cf: { image: { width: 300, height: 300, fit: "cover", quality: 85, format: "jpeg" } },
    });
    if (resized.ok) {
      const buf = await resized.arrayBuffer();
      await env.IMAGES_PUBLIC.put(thumbKey, buf, {
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
    }
  } catch (e) {
    // Non-fatal: keep going even if thumb fails
    console.warn("thumb generation failed", e);
  }

  // Update Supabase row
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const image_url = `${cdnBase}/${originalKey}`;
    // NOTE: we only write guaranteed columns. Your UI already falls back to image_url if no thumb field exists.
    if (entityType === "playlist") {
      await supabase.from("playlists").update({ image_key: originalKey, image_url }).eq("id", entityId);
    } else {
      await supabase.from("profiles").update({ avatar_key: originalKey, avatar_url: image_url }).eq("id", entityId);
    }
  } catch (e) {
    // Still return success for the upload; UI will refetch and you can update DB later if needed
    console.warn("supabase update failed", e);
  }

  return json(
    200,
    {
      ok: true,
      image_key: originalKey,
      image_url: `${cdnBase}/${originalKey}`,
      // thumb fields returned for convenience (even if DB doesn’t persist them)
      thumb_key: thumbKey,
      thumb_url: `${cdnBase}/${thumbKey}`,
    },
    origin
  );
};
