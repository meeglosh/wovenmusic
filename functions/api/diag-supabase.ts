// functions/api/diag-supabase.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function projectRefFromUrl(u: string): string | null {
  try {
    const host = new URL(u).host; // <ref>.supabase.co
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function tryFetchPlaylist(srv: ReturnType<typeof createClient>, id: string) {
  const tables = ["playlists", "playlist", "public.playlists", "public.playlist"];
  const attempts: Array<{ table: string; status: "found" | "empty" | "error"; error?: string }> = [];
  for (const t of tables) {
    const r = await srv.from(t).select("*").eq("id", id).maybeSingle();
    if (r.error) {
      attempts.push({ table: t, status: "error", error: r.error.message });
    } else if (r.data) {
      attempts.push({ table: t, status: "found" });
      return { table: t, data: r.data, attempts };
    } else {
      attempts.push({ table: t, status: "empty" });
    }
  }
  return { table: null as string | null, data: null, attempts };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const playlistId = url.searchParams.get("playlist_id") || "";

  const envReport = {
    supabaseUrl: env.SUPABASE_URL || null,
    projectRef: env.SUPABASE_URL ? projectRefFromUrl(env.SUPABASE_URL) : null,
    anonKeyPresent: Boolean(env.SUPABASE_ANON_KEY),
    serviceKeyPresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (!envReport.supabaseUrl || !envReport.serviceKeyPresent) {
    return new Response(JSON.stringify({ ok: false, why: "missing_env", env: envReport }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const srv = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Quick DB ping (select from pg_tables)
  const ping = await srv.from("pg_tables").select("schemaname,tablename").limit(1);
  const result: any = {
    ok: !ping.error,
    env: envReport,
    dbPing: ping.error ? { ok: false, error: ping.error.message } : { ok: true },
  };

  if (playlistId) {
    const found = await tryFetchPlaylist(srv, playlistId);
    result.playlistLookup = found;
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
