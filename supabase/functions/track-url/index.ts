import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPrivateSignedUrl } from "../_shared/r2.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response(JSON.stringify({ ok:false, error:"missing id" }), { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: t, error } = await supabase
      .from("tracks")
      .select("id, storage_key, is_public, storage_url")
      .eq("id", id)
      .single();

    if (error || !t) return new Response(JSON.stringify({ ok:false, error:"not found" }), { status: 404 });

    if (t.is_public && t.storage_url) {
      return Response.json({ ok: true, url: t.storage_url, kind: "public" });
    }

    const signed = await getPrivateSignedUrl(t.storage_key, 3600);
    return Response.json({ ok: true, url: signed, kind: "signed" });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status: 500 });
  }
});
