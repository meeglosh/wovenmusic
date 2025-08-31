// functions/api/process-audio.ts
export const onRequestPost: PagesFunction<{
  MUSIC_BUCKET: R2Bucket;
  R2_PUBLIC_BASE?: string;
}> = async ({ request, env }) => {
  try {
    const form = await request.formData();
    const file = form.get("audio") as File | null;
    const quality = (form.get("quality") as string) || "mp3-320";
    const fileName = (form.get("fileName") as string) || file?.name || "upload";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    // Decide if we *should* transcode (we won't here; just store-as-is)
    const lower = file.name.toLowerCase();
    const ext = lower.slice(lower.lastIndexOf(".") + 1);
    const isNative = ["mp3", "m4a", "aac"].includes(ext);

    // Build storage key (foldered by date for tidiness)
    const now = new Date();
    const y = String(now.getUTCFullYear());
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const rand = crypto.randomUUID().slice(0, 8);
    const safeBase = fileName.replace(/[^\w.\-]+/g, "_");
    const storageKey = `${y}/${m}/${d}/${rand}_${safeBase}`;

    // Write file into R2
    await env.MUSIC_BUCKET.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type || "audio/mpeg" },
    });

    // If you have a public CDN for this bucket, we can return it
    // Otherwise the client will play via GET /api/track?key=...
    const publicUrl = env.R2_PUBLIC_BASE ? `${env.R2_PUBLIC_BASE}/${storageKey}` : undefined;

    return new Response(
      JSON.stringify({
        ok: true,
        storage_key: storageKey,
        storage_bucket: "MUSIC_BUCKET",
        url: publicUrl,           // present only if bucket/CDN is public
        transcoded: false,        // important: MP3 never "transcodes"
        quality,
        originalFilename: fileName,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      `process-audio failed: ${err?.message || "unknown error"}`,
      { status: 500 }
    );
  }
};
