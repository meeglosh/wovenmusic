
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPrivateSignedUrl } from "../_shared/r2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-client-info, apikey, authorization, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

// Generate possible storage paths based on creation date and current storage patterns
async function getPossibleStoragePaths(currentStorageKey: string, createdAt: string): Promise<string[]> {
  const paths: string[] = [];
  
  // Always try the current storage key first (backward compatibility)
  paths.push(currentStorageKey);
  
  // Extract filename from current storage key
  const filename = currentStorageKey.split('/').pop() || '';
  const trackId = filename.split('.')[0];
  const extension = filename.includes('.') ? filename.split('.').pop() : 'mp3';
  
  // Parse creation date for date-based paths
  const creationDate = new Date(createdAt);
  const year = creationDate.getFullYear();
  const month = String(creationDate.getMonth() + 1).padStart(2, '0');
  const day = String(creationDate.getDate()).padStart(2, '0');
  
  // Try date-based folder structures
  paths.push(`${year}/${month}/${day}/${filename}`);
  paths.push(`${year}/${month}/${day}/${trackId}.${extension}`);
  paths.push(`tracks/${year}/${month}/${day}/${filename}`);
  paths.push(`tracks/${year}/${month}/${day}/${trackId}.${extension}`);
  
  // Try year/month only
  paths.push(`${year}/${month}/${filename}`);
  paths.push(`tracks/${year}/${month}/${filename}`);
  
  // Try different common naming patterns
  if (filename !== `${trackId}.${extension}`) {
    paths.push(`tracks/${trackId}.${extension}`);
  }
  
  // Remove duplicates while preserving order
  const uniquePaths = [];
  const seen = new Set();
  for (const path of paths) {
    if (!seen.has(path)) {
      seen.add(path);
      uniquePaths.push(path);
    }
  }
  
  return uniquePaths;
}

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
    const debug = url.searchParams.get("debug") === "1";
    
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
      .select("id, storage_key, is_public, storage_url, created_at")
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

    // Try to find the file using multiple possible paths
    console.log(`Generating signed URL for track ${id}, storage_key: "${t.storage_key}"`);
    console.log(`Using private bucket: ${Deno.env.get("R2_BUCKET_PRIVATE")}`);
    
    const possiblePaths = await getPossibleStoragePaths(t.storage_key, t.created_at);
    console.log(`Trying ${possiblePaths.length} possible paths for track ${id}`);
    
    let signed = null;
    let workingPath = null;
    
    // Try each possible path until we find one that works
    for (const path of possiblePaths) {
      try {
        console.log(`Trying path: ${path}`);
        const testSigned = await getPrivateSignedUrl(path, 3600);
        
        // Test if file exists at this path
        const testResponse = await fetch(testSigned, { method: 'HEAD' });
        console.log(`HEAD request status: ${testResponse.status} for path: ${path}`);
        
        if (testResponse.status === 200) {
          signed = testSigned;
          workingPath = path;
          console.log(`✅ Found file at path: ${path}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Failed to test path ${path}:`, error.message);
        continue;
      }
    }
    
    if (!signed) {
      console.error(`❌ File not found at any of the ${possiblePaths.length} possible paths for track ${id}`);
      return new Response(JSON.stringify({
        ok: false,
        error: `File not found for track ${id}`,
        paths_tried: possiblePaths
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // If we found the file at a different path, we should update the database
    if (workingPath && workingPath !== t.storage_key) {
      console.log(`🔄 Updating storage_key in database: "${t.storage_key}" -> "${workingPath}"`);
      try {
        const { error: updateError } = await supabase
          .from('tracks')
          .update({ storage_key: workingPath })
          .eq('id', id);
        
        if (updateError) {
          console.error('Failed to update storage_key:', updateError.message);
        } else {
          console.log('✅ Updated storage_key in database');
        }
      } catch (updateErr) {
        console.error('Error updating storage_key:', updateErr);
      }
    }
    
    // Debug mode: check actual R2 response headers
    if (debug) {
      try {
        console.log(`Debug mode: checking headers for ${signed.substring(0, 200)}...`);
        const response = await fetch(signed, { method: 'HEAD' });
        const debugInfo = {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          acceptRanges: response.headers.get('accept-ranges'),
          etag: response.headers.get('etag'),
          urlSample: signed.substring(0, 200) + '...'
        };
        console.log('Debug headers:', JSON.stringify(debugInfo, null, 2));
        return new Response(JSON.stringify({ 
          ok: true, 
          url: signed, 
          kind: "signed", 
          debug: debugInfo 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (debugError) {
        console.error('Debug HEAD request failed:', debugError);
        return new Response(JSON.stringify({ 
          ok: true, 
          url: signed, 
          kind: "signed", 
          debugError: String(debugError) 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
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
