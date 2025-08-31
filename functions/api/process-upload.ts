// functions/api/process-upload.ts
type Env = {
  AUDIO_PUBLIC: R2Bucket;
  AUDIO_PRIVATE: R2Bucket;
  R2_PUBLIC_BASE?: string;            // e.g. https://wovenmusic-public....r2.cloudflarestorage.com
  TRANSCODE_ENDPOINT?: string;        // optional (for WAV/AIF offload)
};

const OK_EXTS = new Set(["mp3","aac","m4a"]);
const TRANSCODE_EXTS = new Set(["wav","aif","aiff","flac"]);

const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const clean = (s: string) => s.replace(/[^\w.\-]+/g, "_").slice(0,200);

const json = (v:any, init:ResponseInit={}) =>
  new Response(JSON.stringify(v), { ...init, headers: { "content-type": "application/json", ...(init.headers||{}) } });

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405, headers: corsHeaders() });
  }

  try {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) return json({ error: "Missing 'audio' file" }, { status: 400, headers: corsHeaders() });

    const desired = ((form.get("visibility") as string) || "private").toLowerCase(); // "public" | "private"
    const targetBucket = desired === "public" ? env.AUDIO_PUBLIC : env.AUDIO_PRIVATE;

    const originalName = clean((form.get("fileName") as string) || file.name || "upload");
    const e = ext(originalName);
    const direct = OK_EXTS.has(e);

    // Generate R2 key
    const now = new Date();
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${String(now.getUTCDate()).padStart(2,"0")}/${crypto.randomUUID()}-${originalName.replace(/\.[^.]+$/,"")}.${direct ? e : "mp3"}`;

    let body: ReadableStream | null = null;
    let contentType = direct ? (file.type || "audio/mpeg") : "audio/mpeg";
    let transcoded = false;

    if (direct) {
      body = file.stream();
    } else {
      // Optional offload → store back to *your* bucket
      if (!env.TRANSCODE_ENDPOINT || !TRANSCODE_EXTS.has(e)) {
        return json({ error: "Unsupported format; enable transcoding or upload MP3/M4A/AAC" }, { status: 415, headers: corsHeaders() });
      }
      const f = new FormData();
      f.append("audio", file, originalName);
      f.append("outputFormat", "mp3");
      f.append("bitrate", "320k");
      const t = await fetch(env.TRANSCODE_ENDPOINT, { method:"POST", body:f });
      if (!t.ok) {
        const txt = await t.text().catch(()=> "");
        return json({ error:`Transcode failed: ${t.status} ${txt}` }, { status:502, headers: corsHeaders() });
      }
      const data:any = await t.json().catch(()=> ({}));
      if (!data?.publicUrl) return json({ error:"No publicUrl from transcode service" }, { status:502, headers: corsHeaders() });

      const pulled = await fetch(data.publicUrl);
      if (!pulled.ok || !pulled.body) return json({ error:"Failed to pull transcoded bytes" }, { status:502, headers: corsHeaders() });

      body = pulled.body;
      transcoded = true;
      contentType = "audio/mpeg";
    }

    await targetBucket.put(key, body!, { httpMetadata: { contentType } });

    const publicUrl = desired === "public" && env.R2_PUBLIC_BASE
      ? `${env.R2_PUBLIC_BASE.replace(/\/$/,"")}/${key}`
      : undefined;

    return json(
      { ok:true, storage_key:key, storage_bucket: desired === "public" ? "AUDIO_PUBLIC" : "AUDIO_PRIVATE", publicUrl, url: publicUrl, transcoded },
      { headers: corsHeaders() }
    );
  } catch (err:any) {
    return json({ error: err?.message || "Unexpected error" }, { status:500, headers: corsHeaders() });
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
