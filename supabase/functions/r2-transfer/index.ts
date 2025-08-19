import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface R2TransferRequest {
  trackId: string
  newIsPublic: boolean
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function getR2Client() {
  const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT') ?? ''
  const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID') ?? ''
  const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') ?? ''
  
  return {
    endpoint,
    accessKeyId,
    secretAccessKey
  }
}

async function copyBetweenBuckets(
  fromBucket: string,
  toBucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const r2Config = await getR2Client()
  
  // Download from source bucket
  const sourceUrl = `${r2Config.endpoint}/${fromBucket}/${key}`
  const downloadResponse = await fetch(sourceUrl)
  
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download from ${fromBucket}: ${downloadResponse.statusText}`)
  }
  
  const fileData = new Uint8Array(await downloadResponse.arrayBuffer())
  
  // Upload to destination bucket
  const destUrl = `${r2Config.endpoint}/${toBucket}/${key}`
  const uploadResponse = await fetch(destUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: fileData,
  })
  
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload to ${toBucket}: ${uploadResponse.statusText}`)
  }
  
  // Delete from source bucket
  const deleteResponse = await fetch(sourceUrl, {
    method: 'DELETE'
  })
  
  if (!deleteResponse.ok) {
    console.warn(`Failed to delete from ${fromBucket}: ${deleteResponse.statusText}`)
  }
  
  return key
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { trackId, newIsPublic }: R2TransferRequest = await req.json()
    
    // Validate user auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Get track details
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .eq('created_by', user.id)
      .single()
    
    if (trackError || !track) {
      throw new Error('Track not found or access denied')
    }
    
    // Skip if not R2 storage or no change needed
    if (track.storage_type !== 'r2' || track.is_public === newIsPublic) {
      return new Response(
        JSON.stringify({ success: true, message: 'No transfer needed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    if (!track.storage_key) {
      throw new Error('No storage key found for track')
    }
    
    const fromBucket = track.is_public ? 'wovenmusic-public' : 'wovenmusic-private'
    const toBucket = newIsPublic ? 'wovenmusic-public' : 'wovenmusic-private'
    
    // Transfer file between buckets
    const newKey = await copyBetweenBuckets(
      fromBucket,
      toBucket,
      track.storage_key,
      'audio/mpeg' // Default content type
    )
    
    // Update track record
    const r2Config = await getR2Client()
    const updateData = {
      is_public: newIsPublic,
      storage_key: newKey,
      storage_url: newIsPublic 
        ? `${r2Config.endpoint.replace('//', '//public.')}/wovenmusic-public/${newKey}`
        : null
    }
    
    const { error: updateError } = await supabase
      .from('tracks')
      .update(updateData)
      .eq('id', trackId)
      .eq('created_by', user.id)
    
    if (updateError) {
      throw updateError
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        newBucket: toBucket,
        storageKey: newKey,
        publicUrl: updateData.storage_url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error('R2 transfer error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})