import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function generateSignedUrl(bucketName: string, key: string, expiresIn = 3600): Promise<string> {
  // For now, return a placeholder - actual signed URL generation would need AWS SDK
  // This will be updated with proper AWS SDK v3 implementation
  const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT') ?? ''
  return `${endpoint}/${bucketName}/${key}?signed=true&expires=${Date.now() + expiresIn * 1000}`
}

async function checkBandMemberAccess(track: any, userId: string): Promise<boolean> {
  try {
    // Check if current user is a band member
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('is_band_member')
      .eq('id', userId)
      .single()
    
    if (!currentUserProfile?.is_band_member) {
      return false
    }
    
    // Check if track creator is a band member
    const { data: trackCreatorProfile } = await supabase
      .from('profiles')
      .select('is_band_member')
      .eq('id', track.created_by)
      .single()
    
    return trackCreatorProfile?.is_band_member || false
  } catch (error) {
    console.error('Error checking band member access:', error)
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const trackId = url.pathname.split('/').pop()
    
    if (!trackId) {
      throw new Error('Track ID is required')
    }
    
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
      .single()
    
    if (trackError || !track) {
      throw new Error('Track not found')
    }
    
    // Check access permissions
    const hasAccess = track.is_public || 
                     track.created_by === user.id ||
                     await checkBandMemberAccess(track, user.id)
    
    if (!hasAccess) {
      throw new Error('Access denied')
    }
    
    // Return appropriate URL
    let fileUrl: string
    
    if (track.storage_type === 'r2') {
      if (track.is_public && track.storage_url) {
        // Public track - return direct URL
        fileUrl = track.storage_url
      } else if (track.storage_key) {
        // Private track - generate signed URL
        const bucketName = track.is_public ? 'wovenmusic-public' : 'wovenmusic-private'
        fileUrl = await generateSignedUrl(bucketName, track.storage_key, 3600)
      } else {
        throw new Error('Invalid storage configuration')
      }
    } else {
      // Legacy Supabase storage
      fileUrl = track.file_url || ''
    }
    
    return new Response(
      JSON.stringify({
        fileUrl,
        expiresAt: track.storage_type === 'r2' && !track.is_public 
          ? new Date(Date.now() + 3600 * 1000).toISOString()
          : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error('Track URL error:', error)
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