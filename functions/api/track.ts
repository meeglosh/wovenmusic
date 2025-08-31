// functions/api/track.ts
// Streams an R2 object with Range support (works for private buckets)
export const onRequestGet: PagesFunction<{ MUSIC_BUCKET: R2Bucket }> = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const rangeHeader = request.headers.get("Range");
  let object: R2Object | R2ObjectBody | null = null;
  let status = 200;
  let headers: HeadersInit = {};

  if (rangeHeader) {
    // Parse "bytes=start-end"
    const m = /^bytes=(\d+)-(\d+)?$/.exec(rangeHeader);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : undefined;
      const length = end !== undefined ? end - start + 1 : undefined;

      object = await env.MUSIC_BUCKET.get(key, {
        range: { offset: start, length },
      });
      status = 206;
      if (object && "size" in object) {
        const size = object.size;
        const endPos = end !== undefined ? end : size - 1;
        headers["Content-Range"] = `bytes ${start}-${endPos}/${size}`;
        headers["Accept-Ranges"] = "bytes";
        headers["Content-Length"] = String((object as R2ObjectBody).body ? (object as R2ObjectBody).body!.length || length || (size - start) : length || (size - start));
      }
    }
  }

  if (!object) {
    object = await env.MUSIC_BUCKET.get(key);
  }
  if (!object || !("body" in object)) return new Response("Not found", { status: 404 });

  const ct = object.httpMetadata?.contentType || "audio/mpeg";
  headers["Content-Type"] = ct;
  if (status !== 206) {
    headers["Content-Length"] = String((object as R2ObjectBody).body ? (object as R2ObjectBody).body!.length || object.size : object.size);
  }

  return new Response((object as R2ObjectBody).body, { status, headers });
};
