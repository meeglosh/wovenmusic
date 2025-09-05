import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPrivateSignedUrl, r2, BUCKET_PRIVATE, BUCKET_PUBLIC, isR2Configured } from "../_shared/r2.ts";
import { ListObjectsV2Command, HeadObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'x-client-info, apikey, authorization, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: string;
}

async function testR2Connectivity(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const timestamp = new Date().toISOString();

  // Test 1: R2 Configuration Check
  results.push({
    test: "R2 Configuration",
    status: isR2Configured ? 'success' : 'error',
    message: isR2Configured ? 
      "R2 properly configured and ready" : 
      "R2 configuration incomplete",
    details: {
      configured: isR2Configured,
      bucketPrivate: BUCKET_PRIVATE || 'NOT_SET',
      bucketPublic: BUCKET_PUBLIC || 'NOT_SET',
      r2PublicBase: Deno.env.get("R2_PUBLIC_BASE_URL") || 'NOT_SET',
      accountId: Deno.env.get("CLOUDFLARE_R2_ACCOUNT_ID") ? 'SET' : 'NOT_SET',
      accessKey: Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID") ? 'SET' : 'NOT_SET',
      secretKey: Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") ? 'SET' : 'NOT_SET'
    },
    timestamp
  });

  if (!isR2Configured || !r2) {
    return results;
  }

  // Test 2: List bucket contents with different prefixes
  try {
    console.log(`🔍 Listing objects in bucket: ${BUCKET_PRIVATE}`);
    
    // Test root level
    const listRootCommand = new ListObjectsV2Command({
      Bucket: BUCKET_PRIVATE,
      MaxKeys: 20,
      Prefix: ''
    });
    
    const rootResponse = await r2.send(listRootCommand);
    
    // Test tracks folder
    const listTracksCommand = new ListObjectsV2Command({
      Bucket: BUCKET_PRIVATE,
      MaxKeys: 20,
      Prefix: 'tracks/'
    });
    
    const tracksResponse = await r2.send(listTracksCommand);
    
    results.push({
      test: "Bucket Access & Contents",
      status: 'success',
      message: `Successfully accessed private bucket`,
      details: {
        rootLevelFiles: rootResponse.KeyCount || 0,
        tracksFolder: tracksResponse.KeyCount || 0,
        totalFound: (rootResponse.KeyCount || 0) + (tracksResponse.KeyCount || 0),
        sampleRootFiles: rootResponse.Contents?.slice(0, 5).map(obj => obj.Key) || [],
        sampleTrackFiles: tracksResponse.Contents?.slice(0, 5).map(obj => obj.Key) || []
      },
      timestamp
    });
  } catch (error) {
    results.push({
      test: "Bucket Access & Contents",
      status: 'error',
      message: `Failed to access private bucket: ${error.message}`,
      details: { error: String(error) },
      timestamp
    });
  }

  // Test 3: Check specific problem file
  try {
    const problemFile = '2d97a005-e129-41e6-a1ba-8079be0ddfd7.mp3';
    console.log(`🔍 Checking specific problem file: ${problemFile}`);
    
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_PRIVATE,
      Key: problemFile
    });
    
    const headResponse = await r2.send(headCommand);
    
    results.push({
      test: "Problem File Check",
      status: 'success',
      message: `Found problem file: ${problemFile}`,
      details: {
        key: problemFile,
        contentLength: headResponse.ContentLength,
        contentType: headResponse.ContentType,
        lastModified: headResponse.LastModified,
        etag: headResponse.ETag
      },
      timestamp
    });
  } catch (error) {
    results.push({
      test: "Problem File Check",
      status: 'warning',
      message: `Problem file not found at root: 2d97a005-e129-41e6-a1ba-8079be0ddfd7.mp3`,
      details: { 
        error: String(error),
        suggestion: "File may be in tracks/ folder or at different path"
      },
      timestamp
    });
  }

  // Test 4: Test signed URL generation
  try {
    const testPath = '2d97a005-e129-41e6-a1ba-8079be0ddfd7.mp3';
    const signedUrl = await getPrivateSignedUrl(testPath, 300);
    
    results.push({
      test: "Signed URL Generation",
      status: 'success',
      message: "Successfully generated signed URL",
      details: {
        testPath,
        urlLength: signedUrl.length,
        urlSample: signedUrl.substring(0, 100) + '...'
      },
      timestamp
    });
  } catch (error) {
    results.push({
      test: "Signed URL Generation",
      status: 'error',
      message: `Failed to generate signed URL: ${error.message}`,
      details: { error: String(error) },
      timestamp
    });
  }

  return results;
}

async function verifyTrackFiles(trackIds?: string[]): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const timestamp = new Date().toISOString();

  const supabase = createClient(
    Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
  );

  // Get tracks to verify
  let query = supabase
    .from("tracks")
    .select("id, title, storage_key, storage_type, created_at")
    .eq("storage_type", "r2");

  if (trackIds && trackIds.length > 0) {
    query = query.in("id", trackIds);
  } else {
    query = query.limit(10);
  }

  const { data: tracks, error } = await query;

  if (error) {
    results.push({
      test: "Database Query",
      status: 'error',
      message: `Failed to query tracks: ${error.message}`,
      details: { error },
      timestamp
    });
    return results;
  }

  if (!tracks || tracks.length === 0) {
    results.push({
      test: "Database Query", 
      status: 'warning',
      message: "No R2 tracks found in database",
      timestamp
    });
    return results;
  }

  // Test each track
  let successCount = 0;
  let errorCount = 0;
  const errorDetails: any[] = [];

  for (const track of tracks) {
    try {
      // Try to get signed URL and test HEAD request
      const signedUrl = await getPrivateSignedUrl(track.storage_key, 300);
      const response = await fetch(signedUrl, { method: 'HEAD' });
      
      if (response.status === 200) {
        successCount++;
      } else {
        errorCount++;
        errorDetails.push({
          trackId: track.id,
          title: track.title,
          storageKey: track.storage_key,
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      errorCount++;
      errorDetails.push({
        trackId: track.id,
        title: track.title,
        storageKey: track.storage_key,
        error: String(error)
      });
    }
  }

  results.push({
    test: "Track File Verification",
    status: errorCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error',
    message: `Verified ${tracks.length} tracks: ${successCount} accessible, ${errorCount} failed`,
    details: {
      totalTracks: tracks.length,
      successCount,
      errorCount,
      errors: errorDetails.slice(0, 5) // Limit error details
    },
    timestamp
  });

  return results;
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
    const action = url.searchParams.get("action") || "connectivity";
    const trackIds = url.searchParams.get("trackIds")?.split(',').filter(Boolean);

    console.log(`🔍 Running R2 diagnostics: ${action}`);

    let results: DiagnosticResult[] = [];

    switch (action) {
      case "connectivity":
        results = await testR2Connectivity();
        break;
      
      case "tracks":
        results = await verifyTrackFiles(trackIds);
        break;
        
      case "full":
        const connectivityResults = await testR2Connectivity();
        const trackResults = await verifyTrackFiles(trackIds);
        results = [...connectivityResults, ...trackResults];
        break;
        
      default:
        return new Response(JSON.stringify({
          ok: false,
          error: "Invalid action. Use: connectivity, tracks, or full"
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const summary = {
      totalTests: results.length,
      successful: results.filter(r => r.status === 'success').length,
      warnings: results.filter(r => r.status === 'warning').length,
      errors: results.filter(r => r.status === 'error').length
    };

    console.log(`✅ Diagnostics complete: ${summary.successful}/${summary.totalTests} successful`);

    return new Response(JSON.stringify({
      ok: true,
      action,
      summary,
      results,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('R2 diagnostics error:', e);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: String(e),
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});