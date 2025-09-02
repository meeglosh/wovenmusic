// functions/api/diag-supabase.ts
import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function projectRefFromUrl(u: string) {
  try {
    const host = new URL(u).host; // <ref>.supabase.co
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function tryFetchPlaylist(srv: ReturnType<typeof createClient>, id: string) {
  // Try common table names so we're schema-agnostic
  const tables = ["playlists", "playlist", "public.playlists", "public.playlist"];
  const attempts: any[] = [];
  for (const t of tables) {
    const r = await srv.from(t).select("*").eq("id", id).maybeSingle();
    attempts.push({ table: t, status: r.error ? "error" : (r.data ? "found" : "empty"), error: r.error?.message });
    if (!r.error && r.data) return { table: t, data: r.data, attempts };
  }
  return { table: null as string | null, data: null, attempts };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const playlistId = url.searchParams.get("playlist_id") || "";

  // Basic env health (do NOT expose secrets)
  const envReport = {
    supabaseUrl: env.SUPABASE_URL || null,
    projectRef: env.SUPABASE_URL ? projectRefFromUrl(env.SUPABASE_URL) : null,
    anonKeyPresent: Boolean(env.SUPABASE_ANON_KEY),
    serviceKeyPresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };

  // If anything critical is missing, report immediately
  if (!envReport.supabaseUrl || !envReport.serviceKeyPresent) {
    return new Response(JSON.stringify({ ok: false, why: "missing_env", env: envReport }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  // Try a trivial query to prove DB connectivity
  const srv = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const ping = await srv.from("pg_tables").select("schemaname,tablename").limit(1);

  const result: any = {
    ok: !ping.error,
    env: envReport,
    dbPing: ping.error ? { ok: false, error: ping.error.message } : { ok: true },
