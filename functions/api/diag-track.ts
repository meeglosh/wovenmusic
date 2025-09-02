// functions/api/diag-track.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AUDIO_PRIVATE: R2Bucket;
  AUDIO_PUBLIC: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get("id");
    if (!id) return json({ ok: false, error: "Missing id" }, 400);

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: trk, error } = await supa
      .from("tracks")
      .select("id,is_public,storage_type,storage_key,storage_url,file_url,mime_type,title,artist")
      .eq("id", id)
      .single();

    if (error || !trk) return json({ ok: false, error: "Track not found", id }, 404);

    let r2Check: any = null;
    if (trk.storage_type === "r2" && trk.storage_key) {
      const bucket = trk.is_public ? env.AUDIO_PUBLIC : env.AUDIO_PRIVATE;
      const head = await bucket.get(trk.storage_key, { range: { offset: 0, length: 1 } }).catch(() => null);
      r2Check = {
        attemptedKey: trk.storage_key,
        bucket: trk.is_public ? "AUDIO_PUBLIC" : "AUDIO_PRIVATE",
        exists: !!head,
        size: head?.size ?? null,
        contentType: head?.httpMetadata?.contentType ?? null,
        note: head ? "Object found" : "No object at that key",
      };
    }

    return json({
      ok: true,
      id,
      track: trk,
      r2Check,
      hints: [
        "If storage_type !== 'r2', track-stream will 404. Use /api/track-url for legacy files.",
        "If storage_type === 'r2' but r2Check.exists=false, the DB key doesn't match the object path in R2.",
      ],
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

