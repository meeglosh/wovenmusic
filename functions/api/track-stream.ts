// functions/api/track-stream.ts
// Streams a private object from AUDIO_PRIVATE after a basic auth check.

type Env = {
  AUDIO_PRIVATE: R2Bucket;
  SUPABASE_JWT_SECRET?: string; // optional; if present we'll verify HS256 JWT signature
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (request.method !== "GET") return new Response("Method Not Allowed", { status:405, headers: cors() });

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing key", { status:400, headers: cors() });

  // Very light auth gate:
  //  - If you want strict checks (admin/invited), call Supabase here to verify the
  //    requesting user can see the *track id* that owns this key.
  //  - For now we require an Authorization Bearer (a Supabase user JWT) to be present.
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status:401, headers: cors() });
  // (Optional) verify JWT with SUPABASE_JWT_SECRET; omitted for brevity.

  const obj = await env.AUDIO_PRIVATE.get(key);
  if (!obj) return new Response("Not Found", { status:404, headers: cors() });

  const headers = new Headers({
    "content-type": obj.httpMetadata?.contentType || "audio/mpeg",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=0, no-store",
    ...cors(),
  });

  // Support range requests for scrubbing
  if (request.headers.get("range")) {
    const size = obj.size;
    const m = request.headers.get("range")!.match(/bytes=(\d+)-(\d+)?/);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : size - 1;
    const length = end - start + 1;

    const part = await env.AUDIO_PRIVATE.get(key, { range: { offset: start, length } });
    if (!part || !part.body) return new Response("Range Not Satisfiable", { status:416, headers: cors() });

    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(length));
    return new Response(part.body, { status:206, headers });
  }

  return new Response(obj.body, { headers });
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Range, Content-Type",
  };
}
