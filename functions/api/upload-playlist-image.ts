// functions/api/upload-playlist-image.ts
import { createClient } from "@supabase/supabase-js";

export const onRequestPost: PagesFunction<{
  AUDIO_PUBLIC: R2Bucket;             // binding: wovenmusic-public
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE: string;
  CDN_IMAGES_BASE: string;            // e.g. https://images.wovenmusic.app  (no trailing /)
  COVERS_BUCKET_PREFIX?: string;      // optional; defaults to "covers/"
}> = async (ctx) => {
  try {
    const form = await ctx.request.formData();
    const file = form.get("file") as File | null;
    const playlistId = String(form.get("playlistId") || "");

    if (!file)       return j({ error: "Missing file" }, 400);
    if (!playlistId) return j({ error: "Missing playlistId" }, 400);

    const prefix = (ctx.env.COVERS_BUCKET_PREFIX || "covers/").replace(/^\/+|\/+$/g, "") + "/";

    // Work out extension & content type for the ORIGINAL we store
    const nameExt     = (file.name.split(".").pop() || "").toLowerCase();
    const contentType = file.type || "application/octet-stream";
    const extOriginal =
      nameExt ||
      (contentType === "image/jpeg" ? "jpg" :
       contentType === "image/png"  ? "png" :
       contentType === "image/webp" ? "webp" : "bin");

    const keyOriginal = `${prefix}${playlistId}.${extOriginal}`;

    // 1) Save ORIGINAL to public bucket with the right Content-Type
    await ctx.env.AUDIO_PUBLIC.put(keyOriginal, await file.stream(), {
      httpMetadata: { contentType },
    });

    const base = (ctx.env.CDN_IMAGES_BASE || "").replace(/\/+$/g, "");
    if (!base) return j({ error: "Missing CDN_IMAGES_BASE" }, 500);

    const cover_url = `${base}/${keyOriginal}`;

    // 2) Generate 300x300 thumbnail via Cloudflare Image Resizing
    //    - center crop ("fit: 'cover'") so you always get a square
    //    - output JPEG for maximum compatibility & size
    const thumbKey  = `${prefix}thumb-${playlistId}.jpg`;
    let   thumb_url : string | null = null;
    try {
      const resizedRes = await fetch(cover_url, {
        cf: {
          image: {
            width: 300,
            height: 300,
            fit: "cover",        // crop to square; smallest side >= 300
            gravity: "center",
            quality: 82,
            format: "jpeg",
          },
        },
      });

      if (!resizedRes.ok || !resizedRes.body) {
        console.error("[covers] resize failed", resizedRes.status);
      } else {
        await ctx.env.AUDIO_PUBLIC.put(thumbKey, resizedRes.body, {
          httpMetadata: { contentType: "image/jpeg" },
        });
        thumb_url = `${base}/${thumbKey}`;
      }
    } catch (e) {
      console.error("[covers] resize exception", (e as Error)?.message);
    }

    // 3) Update DB with the ORIGINAL cover URL (safe; schema-agnostic)
    //    If you later add a `cover_thumb_url` column, you can include it here.
    const supabase = createClient(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { error } = await supabase
      .from("playlists")
      .update({
        cover_storage_type: "r2",
        cover_storage_key: keyOriginal,
        cover_url, // UI should already read this
        // cover_thumb_url: thumb_url, // uncomment once column exists
      })
      .eq("id", playlistId);

    if (error) return j({ error: "DB update failed", details: error.message }, 500);

    // Respond with both URLs so the client can use the thumb immediately
    return j({ ok: true, cover_url, thumb_url, key: keyOriginal, thumb_key: thumbKey });
  } catch (err: any) {
    return j({ error: err?.message || "Upload failed" }, 500);
  }
};

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}
