// functions/api/track-url.ts
import { createClient } from "@supabase/supabase-js";

export const onRequestGet: PagesFunction<{
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const trackId = url.searchParams.get("id");
    if (!trackId) return new Response("Missing id", { status: 400 });

    // 1) Get the caller's JWT
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response("Unauthorized", { status: 401 });

    // 2) Validate token, get user id
    const supaAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: userRes, error: userErr } = await supaAnon.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return new Response("Unauthorized", { status: 401 });
    const userId = userRes.user.id;

    // 3) Use service role to run the access check RPC
    const supaService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data: can, error: rpcErr } = await supaService
      .rpc("has_track_access", { p_user: userId, p_track: trackId });

    if (rpcErr) {
      console.error("has_track_access rpc error", rpcErr);
      return new Response("Server error", { status: 500 });
    }
    if (!can) return new Response("Forbidden", { status: 403 });

    // 4) (now safe) fetch track storage handle and return URL
    // e.g. select storage_type, storage_key, storage_url ...
    const { data: track, error: trkErr } = await supaService
      .from("tracks")
      .select("storage_type, storage_key, storage_url, is_public")
      .eq("id", trackId)
      .single();

    if (trkErr || !track) return new Response("Not found", { status: 404 });

    // ...resolve to R2 public URL or sign a private URL...
    // return new Response(JSON.stringify({ url, expiresAt }), { headers: { "content-type": "application/json" } });

    return new Response(JSON.stringify({ url: "TODO: build URL here" }), {
      headers: { "content-type": "application/json" }
    });

  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
};
