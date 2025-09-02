// functions/api/cover-redirect.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CDN_IMAGES_BASE?: string; // optional; default below
};

const DEFAULT_BASE = "https://images.wovenmusic.app";

function isHttp(s: string) { return /^https?:\/\//i.test(s); }
function normalizeKey(raw: string): string {
  let k = raw.trim().replace(/^\/+/, "");
  k = k.replace(/^playlist-images\//, "images/");
  k = k.replace(/^profile-images\//, "images/");
  if (!k.includes("/")) k = `images/playlists/${k}`;
  if (k.startsWith("images/")) {
    const rest = k.slice("images/".length);
    if (rest && !rest.includes("/")) k = `images/playlists/${rest}`;
  }
  if (!k.startsWith("images/")) k = `images/${k}`;
  return k;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const u = new URL(request.url);
    const playlistId = u.searchParams.get("playlist_id");
    if (!playlistId) return new Response("Missing playlist_id", { status: 400 });

    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }});
    const { data: pl, error } = await supa.from("playlists").select("*").eq("id", playlistId).single();
    if (error || !pl) return new Response("Not found", { status: 404 });

    const candidate =
      pl.cover_storage_key || pl.cover_key || pl.image_key ||
      pl.cover_image_url   || pl.image_url || pl.cover_url ||
      pl.artwork_url       || pl.thumbnail_url || pl.image || pl.cover;

    if (!candidate || typeof candidate !== "string" || !candidate.trim()) {
      return new Response("No cover", { status: 404 });
    }

    let redirectTo = "";
    if (isHttp(candidate)) {
      try {
        const asUrl = new URL(candidate);
        const path = asUrl.pathname.replace(/^\/+/, "");
        const host = asUrl.hostname;
        const isR2Public = host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");
        const cdnHost = new URL((env.CDN_IMAGES_BASE || DEFAULT_BASE)).hostname;

        if (host === cdnHost || isR2Public) {
          redirectTo = `${(env.CDN_IMAGES_BASE || DEFAULT_BASE).replace(/\/+$/, "")}/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
        } else {
          // foreign absolute URL → redirect as-is
          redirectTo = candidate;
        }
      } catch {
        // invalid absolute → treat as key-ish
        const key = normalizeKey(candidate);
        redirectTo = `${(env.CDN_IMAGES_BASE || DEFAULT_BASE).replace(/\/+$/, "")}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
      }
    } else {
      const key = normalizeKey(candidate);
      redirectTo = `${(env.CDN_IMAGES_BASE || DEFAULT_BASE).replace(/\/+$/, "")}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("cover-redirect error", e);
    return new Response("Server error", { status: 500 });
  }
};
