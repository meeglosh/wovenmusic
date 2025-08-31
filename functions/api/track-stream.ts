// functions/api/track-stream.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PRIVATE_BUCKET: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // Auth
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // Access check
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: hasAccess } = await supa.rpc("has_track_access", {
      p_user: userId,
      p_track: trackId,
    });
    if (!hasAccess) return new Response("Forbidden", { status: 403 });

    // Lookup the key
    const { data: track } = await supa
      .from("tracks")
      .select("storage_type, storage_key, mime_type")
      .eq("id", trackId)
      .single();

    if (!track?.storage_key || track.storage_type !== "r2")
      return new Response("Not found", { status: 404 });

    // Range support
    const range = request.headers.get("Range") ?? undefined;
    const obj = await env.PRIVATE_BUCKET.get(track.storage_key, {
      range: range ? { range } : undefined,
    });
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    // MIME if known
    if (track.mime_type) headers.set("Content-Type", track.mime_type);

    // R2 gives these metadata fields:
    if (obj.httpMetadata?.contentType && !headers.has("Content-Type"))
      headers.set("Content-Type", obj.httpMetadata.contentType);

    headers.set("Accept-Ranges", "bytes");
    if (obj.range) {
      headers.set("Content-Range", `bytes ${obj.range.offset}-${obj.range.end}/${obj.size}`);
      headers.set("Content-Length", String(obj.range.end - obj.range.offset + 1));
      return new Response(obj.body, { status: 206, headers });
    } else {
      headers.set("Content-Length", String(obj.size));
      return new Response(obj.body, { status: 200, headers });
    }
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
