// functions/api/track-url.ts
// Looks up a track in Supabase & returns a playable URL.
// If track is public with a permanent URL, return that.
// If private, return first-party /api/track?key=... which streams from R2.
type TrackRow = {
  id: string;
  storage_type: string | null;
  storage_key: string | null;
  storage_url: string | null;
  is_public: boolean | null;
  file_url: string | null; // legacy fallback
};

export const onRequestGet: PagesFunction<{
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_PUBLIC_BASE?: string;
}> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

    // Query Supabase REST
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/tracks?select=id,storage_type,storage_key,storage_url,is_public,file_url&id=eq.${encodeURIComponent(id)}`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return new Response(`Supabase lookup failed: ${t}`, { status: 500 });
    }

    const arr = (await resp.json()) as TrackRow[];
    const row = arr[0];
    if (!row) return new Response(JSON.stringify({ error: "Track not found" }), { status: 404 });

    // 1) Public R2 URL already set
    if (row.storage_type === "r2" && row.is_public && row.storage_url) {
      return json({ url: row.storage_url });
    }

    // 2) Private R2 → stream through our first-party endpoint
    if (row.storage_type === "r2" && row.storage_key) {
      const origin = url.origin;
      return json({ url: `${origin}/api/track?key=${encodeURIComponent(row.storage_key)}` });
    }

    // 3) Legacy Supabase file_url
    if (row.file_url) {
      return json({ url: row.file_url });
    }

    return new Response(JSON.stringify({ error: "No URL available for this track" }), { status: 404 });
  } catch (e: any) {
    return new Response(`track-url failed: ${e?.message || "unknown error"}`, { status: 500 });
  }
};

function json(obj: any) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}
