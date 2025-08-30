import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { r2, BUCKET_PRIVATE, BUCKET_PUBLIC } from "../_shared/r2.ts";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
  'Access-Control-Max-Age': '86400',
};

// Helper function to get proper content type for audio files
function getContentTypeForAudio(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop() || ''
  
  switch (extension) {
    case 'mp3':
    case 'mpeg':
      return 'audio/mpeg'
    case 'm4a':
      return 'audio/mp4'
    case 'wav':
      return 'audio/wav'
    case 'aac':
      return 'audio/aac'
    case 'ogg':
      return 'audio/ogg'
    case 'flac':
      return 'audio/flac'
    case 'aif':
    case 'aiff':
      return 'audio/aiff'
    default:
      return 'audio/mpeg'
  }
}

async function fixObjectMetadata(bucket: string, key: string): Promise<boolean> {
  try {
    console.log(`Fixing metadata for: ${bucket}/${key}`);
    
    // Get the object
    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const obj = await r2.send(getCmd);
    
    if (!obj.Body) {
      console.error(`No body found for ${key}`);
      return false;
    }

    // Get proper content type based on file extension
    const properContentType = getContentTypeForAudio(key);
    
    // Check if content type is already correct
    if (obj.ContentType === properContentType) {
      console.log(`Content type already correct for ${key}: ${obj.ContentType}`);
      return true;
    }
    
    console.log(`Updating content type for ${key}: ${obj.ContentType} -> ${properContentType}`);
    
    // Read the object body
    const bodyBytes = await obj.Body.transformToByteArray();
    
    // Copy with new metadata
    const copyCmd = new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `/${bucket}/${encodeURIComponent(key)}`,
      ContentType: properContentType,
      MetadataDirective: "REPLACE",
      // Preserve cache settings for public objects
      ...(bucket === BUCKET_PUBLIC ? { CacheControl: "public, max-age=31536000, immutable" } : {})
    });
    
    await r2.send(copyCmd);
    console.log(`Successfully updated metadata for ${key}`);
    return true;
    
  } catch (error) {
    console.error(`Failed to fix metadata for ${key}:`, error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin or band member (only they can fix metadata)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, is_band_member')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin && !profile?.is_band_member) {
      return new Response(JSON.stringify({ error: 'Insufficient privileges' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all tracks with R2 storage
    const { data: tracks, error: tracksError } = await supabase
      .from('tracks')
      .select('id, storage_key, storage_type, is_public')
      .eq('storage_type', 'r2')
      .not('storage_key', 'is', null);

    if (tracksError) {
      throw new Error(`Failed to fetch tracks: ${tracksError.message}`);
    }

    console.log(`Found ${tracks?.length || 0} tracks with R2 storage`);

    const results = {
      total: tracks?.length || 0,
      fixed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Fix metadata for each track
    for (const track of tracks || []) {
      const bucket = track.is_public ? BUCKET_PUBLIC : BUCKET_PRIVATE;
      const success = await fixObjectMetadata(bucket, track.storage_key);
      
      if (success) {
        results.fixed++;
      } else {
        results.failed++;
        results.errors.push(`Failed to fix ${track.id}: ${track.storage_key}`);
      }
    }

    console.log(`Metadata fix completed: ${results.fixed} fixed, ${results.failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Fixed metadata for ${results.fixed} out of ${results.total} tracks`,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Metadata fix error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: String(error) 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});