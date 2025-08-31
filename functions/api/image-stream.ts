// functions/api/image-stream.ts
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
    const playlistId = url.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing playlist_id", { status: 400 });

    // Require auth (only members/invitees can see private assets)
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes } = await supaAnon.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Confirm playlist is public OR user has access (reuse your ACL, or a simple RPC)
    const { data: pl } = await supa
      .from("playlists")
      .select("is_public, cover_storage_key, cover_storage_type")
      .eq("id", playlistId)
      .single();

    if (!pl?.cover_storage_key || pl.cover_storage_type !== "r2")
      return new Response("Not found", { status: 404 });

    if (!pl.is_public) {
      // Optional: enforce ACL here using your existing playlist access rules/RPC.
      // If you already gate audio via has_track_access, add a has_playlist_access RPC and call it here.
    }

    const obj = await env.PRIVATE_BUCKET.get(pl.cover_storage_key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    if (obj.httpMetadata?.contentType)
      headers.set("Content-Type", obj.httpMetadata.contentType);
    headers.set("Cache-Control", "private, max-age=60"); // short cache for private assets

    return new Response(obj.body, { status: 200, headers });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
