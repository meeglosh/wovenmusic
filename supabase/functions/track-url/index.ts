
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

interface PathTestResult {
  path: string;
  status: number;
  statusText: string;
  error?: string;
  headers?: Record<string, string>;
  success: boolean;
}

interface DebugInfo {
  trackId: string;
  originalStorageKey: string;
  bucket: string;
  pathsGenerated: string[];
  pathResults: PathTestResult[];
  workingPath?: string;
  finalUrl?: string;
  databaseUpdated?: boolean;
  r2Config: {
    bucketPrivate: string | undefined;
    bucketPublic: string | undefined;
    publicBaseUrl: string | undefined;
  };
}

// Enhanced path generation with more comprehensive fallbacks
async function getPossibleStoragePaths(currentStorageKey: string, createdAt: string, trackId: string): Promise<string[]> {
  const paths: string[] = [];
  
  // Always try the current storage key first (backward compatibility)
  paths.push(currentStorageKey);
  
  // Extract filename from current storage key
  const filename = currentStorageKey.split('/').pop() || '';
  const baseTrackId = filename.split('.')[0];
  const extension = filename.includes('.') ? filename.split('.').pop() : 'mp3';
  
  // Parse creation date for date-based paths
  const creationDate = new Date(createdAt);
  const year = creationDate.getFullYear();
  const month = String(creationDate.getMonth() + 1).padStart(2, '0');
  const day = String(creationDate.getDate()).padStart(2, '0');
  
  // Common file extensions to try
  const extensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
  
  // 1. Date-based folder structures (priority for new files)
  paths.push(`${year}/${month}/${day}/${filename}`);
  paths.push(`${year}/${month}/${day}/${trackId}.${extension}`);
  paths.push(`tracks/${year}/${month}/${day}/${filename}`);
  paths.push(`tracks/${year}/${month}/${day}/${trackId}.${extension}`);
  
  // 2. Year/month only structures
  paths.push(`${year}/${month}/${filename}`);
  paths.push(`tracks/${year}/${month}/${filename}`);
  paths.push(`${year}/${month}/${trackId}.${extension}`);
  paths.push(`tracks/${year}/${month}/${trackId}.${extension}`);
  
  // 3. Legacy tracks folder (most migrated files)
  paths.push(`tracks/${filename}`);
  paths.push(`tracks/${trackId}.${extension}`);
  paths.push(`tracks/${baseTrackId}.${extension}`);
  
  // 4. Root level (some files might be here)
  paths.push(filename);
  paths.push(`${trackId}.${extension}`);
  paths.push(`${baseTrackId}.${extension}`);
  
  // 5. Alternative extensions (in case file was converted)
  for (const ext of extensions) {
    if (ext !== extension) {
      paths.push(`tracks/${trackId}.${ext}`);
      paths.push(`${year}/${month}/${day}/${trackId}.${ext}`);
      paths.push(`tracks/${year}/${month}/${day}/${trackId}.${ext}`);
    }
  }
  
  // 6. Common migratory patterns from different systems
  paths.push(`audio/${trackId}.${extension}`);
  paths.push(`uploads/${trackId}.${extension}`);
  paths.push(`music/${trackId}.${extension}`);
  paths.push(`files/${trackId}.${extension}`);
  
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

// Enhanced path testing with detailed error reporting
async function testPath(path: string, timeout: number = 10000): Promise<PathTestResult> {
  const result: PathTestResult = {
    path,
    status: 0,
    statusText: '',
    success: false
  };
  
  try {
    console.log(`🔍 Testing path: ${path}`);
    const testSigned = await getPrivateSignedUrl(path, 3600);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const testResponse = await fetch(testSigned, { 
        method: 'HEAD',
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      result.status = testResponse.status;
      result.statusText = testResponse.statusText;
      result.success = testResponse.status === 200;
      
      // Capture useful headers
      result.headers = {
        'content-type': testResponse.headers.get('content-type') || '',
        'content-length': testResponse.headers.get('content-length') || '',
        'etag': testResponse.headers.get('etag') || '',
        'last-modified': testResponse.headers.get('last-modified') || ''
      };
      
      if (result.success) {
        console.log(`✅ Found file at path: ${path} (${result.headers['content-type']}, ${result.headers['content-length']} bytes)`);
      } else {
        console.log(`❌ Path ${path} returned ${result.status}: ${result.statusText}`);
      }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error) {
    result.error = error.message || String(error);
    console.log(`❌ Failed to test path ${path}: ${result.error}`);
    
    // Classify error types
    if (error.name === 'AbortError') {
      result.error = `Timeout after ${timeout}ms`;
    } else if (error.message?.includes('DNS')) {
      result.error = 'DNS resolution failed - check R2 configuration';
    } else if (error.message?.includes('AUTH')) {
      result.error = 'Authentication failed - check R2 credentials';
    }
  }
  
  return result;
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

    // Enhanced path resolution and testing
    console.log(`🚀 Starting enhanced path resolution for track ${id}`);
    console.log(`📋 Original storage_key: "${t.storage_key}"`);
    console.log(`🪣 Using private bucket: ${Deno.env.get("R2_BUCKET_PRIVATE")}`);
    
    // Initialize debug info
    const debugInfo: DebugInfo = {
      trackId: id,
      originalStorageKey: t.storage_key,
      bucket: Deno.env.get("R2_BUCKET_PRIVATE") || 'unknown',
      pathsGenerated: [],
      pathResults: [],
      r2Config: {
        bucketPrivate: Deno.env.get("R2_BUCKET_PRIVATE"),
        bucketPublic: Deno.env.get("R2_BUCKET_PUBLIC"),
        publicBaseUrl: Deno.env.get("R2_PUBLIC_BASE_URL")
      }
    };
    
    const possiblePaths = await getPossibleStoragePaths(t.storage_key, t.created_at, id);
    debugInfo.pathsGenerated = possiblePaths;
    console.log(`🔍 Generated ${possiblePaths.length} possible paths for track ${id}`);
    
    let signed = null;
    let workingPath = null;
    
    // Test each path with enhanced error reporting
    for (const path of possiblePaths) {
      const result = await testPath(path);
      debugInfo.pathResults.push(result);
      
      if (result.success) {
        // Generate the signed URL for the working path
        signed = await getPrivateSignedUrl(path, 3600);
        workingPath = path;
        debugInfo.workingPath = path;
        debugInfo.finalUrl = signed;
        console.log(`🎯 Using working path: ${path}`);
        break;
      }
    }
    
    // If no file found, provide comprehensive error information
    if (!signed) {
      console.error(`❌ File not found at any of the ${possiblePaths.length} possible paths for track ${id}`);
      
      // Analyze the error patterns
      const errorSummary = {
        totalPathsTried: debugInfo.pathResults.length,
        statusCodes: {} as Record<number, number>,
        commonErrors: [] as string[],
        suggestions: [] as string[]
      };
      
      debugInfo.pathResults.forEach(result => {
        if (result.status > 0) {
          errorSummary.statusCodes[result.status] = (errorSummary.statusCodes[result.status] || 0) + 1;
        }
        if (result.error && !errorSummary.commonErrors.includes(result.error)) {
          errorSummary.commonErrors.push(result.error);
        }
      });
      
      // Generate suggestions based on error patterns
      if (errorSummary.statusCodes[403]) {
        errorSummary.suggestions.push("Check R2 bucket permissions and access keys");
      }
      if (errorSummary.statusCodes[404] > 0 && errorSummary.statusCodes[400] === 0) {
        errorSummary.suggestions.push("File may be in a different bucket or deleted");
      }
      if (errorSummary.commonErrors.some(e => e.includes('timeout'))) {
        errorSummary.suggestions.push("Network connectivity issues with R2");
      }
      
      return new Response(JSON.stringify({
        ok: false,
        error: `File not found for track ${id}`,
        paths_tried: possiblePaths.slice(0, 10), // Limit to first 10 for readability
        total_paths_tried: possiblePaths.length,
        error_summary: errorSummary,
        ...(debug ? { debug_info: debugInfo } : {})
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Update database if we found the file at a different path
    if (workingPath && workingPath !== t.storage_key) {
      console.log(`🔄 Updating storage_key in database: "${t.storage_key}" -> "${workingPath}"`);
      try {
        const { error: updateError } = await supabase
          .from('tracks')
          .update({ storage_key: workingPath })
          .eq('id', id);
        
        if (updateError) {
          console.error('❌ Failed to update storage_key:', updateError.message);
        } else {
          console.log('✅ Updated storage_key in database');
          debugInfo.databaseUpdated = true;
        }
      } catch (updateErr) {
        console.error('❌ Error updating storage_key:', updateErr);
      }
    }
    
    // Debug mode: provide comprehensive debug information
    if (debug) {
      try {
        console.log(`🔍 Debug mode: checking final URL headers...`);
        const response = await fetch(signed, { method: 'HEAD' });
        const finalDebugInfo = {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          acceptRanges: response.headers.get('accept-ranges'),
          etag: response.headers.get('etag'),
          urlSample: signed.substring(0, 200) + '...'
        };
        console.log('Final URL debug headers:', JSON.stringify(finalDebugInfo, null, 2));
        
        return new Response(JSON.stringify({ 
          ok: true, 
          url: signed, 
          kind: "signed", 
          debug: finalDebugInfo,
          comprehensive_debug: debugInfo
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (debugError) {
        console.error('🔍 Debug HEAD request failed:', debugError);
        return new Response(JSON.stringify({ 
          ok: true, 
          url: signed, 
          kind: "signed", 
          debugError: String(debugError),
          comprehensive_debug: debugInfo
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Success response with optional debug info
    console.log(`✅ Successfully resolved track ${id} with ${workingPath || t.storage_key}`);
    return new Response(JSON.stringify({ 
      ok: true, 
      url: signed, 
      kind: "signed",
      ...(debug ? { debug_info: debugInfo } : {})
    }), {
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
