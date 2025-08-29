
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPrivateSignedUrl } from "../_shared/r2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://wovenmusic.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-client-info, apikey, authorization, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: "missing id" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: t, error } = await supabase
      .from("tracks")
      .select("id, storage_key, is_public, storage_url")
      .eq("id", id)
      .single();

    if (error || !t) {
      console.error(`Track not found: ${id}`, error);
      return new Response(JSON.stringify({ ok: false, error: "not found" }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (t.is_public && t.storage_url) {
      console.log(`Returning public URL for track ${id}: ${t.storage_url}`);
      return new Response(JSON.stringify({ ok: true, url: t.storage_url, kind: "public" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!t.storage_key) {
      console.error(`Track ${id} has no storage_key`);
      return new Response(JSON.stringify({ ok: false, error: "no storage key" }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate signed URL using the exact storage_key from DB
    console.log(`Generating signed URL for track ${id}, storage_key: "${t.storage_key}"`);
    const signed = await getPrivateSignedUrl(t.storage_key, 3600);
    console.log(`Generated signed URL: ${signed}`);
    
    return new Response(JSON.stringify({ ok: true, url: signed, kind: "signed" }), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.error('Track URL generation error:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
