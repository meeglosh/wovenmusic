import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { uploadToR2, BUCKET_PUBLIC, PUBLIC_BASE } from '../_shared/r2.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImageUploadRequest {
  fileName: string
  contentType: string
  entityType: 'playlist' | 'profile'
  entityId?: string // playlist ID or profile ID
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse the multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const entityId = formData.get('entityId') as string

    if (!file) {
      throw new Error('No file provided')
    }

    if (!entityType || !['playlist', 'profile'].includes(entityType)) {
      throw new Error('Invalid entity type. Must be "playlist" or "profile"')
    }

    // Validate file type (only images)
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed')
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB')
    }

    // Generate the storage key
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const key = `images/${entityType}s/${entityId || user.id}_${timestamp}.${fileExtension}`

    // Convert file to Uint8Array
    const fileData = new Uint8Array(await file.arrayBuffer())
    
    // Upload to R2 public bucket
    const publicUrl = await uploadToR2({
      key,
      body: fileData,
      contentType: file.type,
      isPublic: true
    })

    // The full R2 URL
    const fullUrl = publicUrl || `${PUBLIC_BASE}/${key}`

    // Update the appropriate table with both image_key and image_url
    if (entityType === 'playlist' && entityId) {
      const { error: updateError } = await supabase
        .from('playlists')
        .update({ 
          image_key: key,
          image_url: fullUrl
        })
        .eq('id', entityId)
        .eq('created_by', user.id) // Ensure user owns the playlist

      if (updateError) {
        console.error('Failed to update playlist:', updateError)
        throw new Error(`Failed to update playlist: ${updateError.message}`)
      }
    } else if (entityType === 'profile') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_key: key,
          avatar_url: fullUrl
        })
        .eq('id', user.id) // Update user's own profile

      if (updateError) {
        console.error('Failed to update profile:', updateError)
        throw new Error(`Failed to update profile: ${updateError.message}`)
      }
    }

    // Log successful upload
    await supabase.rpc('log_security_event', {
      p_event_type: 'image_upload_success',
      p_event_details: {
        file_name: file.name,
        storage_key: key,
        entity_type: entityType,
        entity_id: entityId
      },
      p_user_id: user.id
    })

    return new Response(
      JSON.stringify({
        success: true,
        key,
        url: fullUrl
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error('Image upload error:', error)
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