import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { uploadToR2, BUCKET_PUBLIC, BUCKET_PRIVATE } from '../_shared/r2.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface R2UploadRequest {
  fileName: string
  contentType: string
  isPublic: boolean
  trackId?: string
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Helper function to get proper content type for audio files
function getContentTypeForAudio(fileName: string, fallbackType: string): string {
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
      return fallbackType || 'audio/mpeg'
  }
}

async function generateSignedUrl(bucketName: string, key: string, expiresIn = 3600): Promise<string> {
  // This function would need proper implementation with AWS SDK for signed URLs
  // For now, we use the shared getPrivateSignedUrl function
  return `signed-url-placeholder-${key}`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get file from FormData first to validate it
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('No file provided')
    }
    
    // Validate file type (audio files only)
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 
      'audio/aac', 'audio/ogg', 'audio/webm', 'audio/m4a'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}. Only audio files are allowed.`)
    }
    
    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes. Maximum size is ${maxSize} bytes.`)
    }
    
    // Get additional parameters from FormData
    const fileName = formData.get('fileName') as string || file.name
    const isPublic = formData.get('isPublic') === 'true'
    const trackId = formData.get('trackId') as string | null
    const contentType = file.type
    console.log('Processing upload for file:', fileName, 'Size:', file.size, 'Type:', contentType)
    
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

    // Log security event
    await supabase.rpc('log_security_event', {
      p_event_type: 'r2_file_upload_attempt',
      p_event_details: {
        file_name: fileName,
        file_size: file.size,
        file_type: contentType,
        is_public: isPublic,
        track_id: trackId
      },
      p_user_id: user.id
    })

    const bucketName = isPublic ? BUCKET_PUBLIC : BUCKET_PRIVATE
    const key = `tracks/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    const fileData = new Uint8Array(await file.arrayBuffer())
    
    // Get proper content type for audio files
    const properContentType = getContentTypeForAudio(fileName, contentType)
    console.log('Using content type:', properContentType, 'for file:', fileName)
    
    // Upload to R2 using shared function with proper Content-Type
    const publicUrl = await uploadToR2({
      key,
      body: fileData,
      contentType: properContentType,
      isPublic
    })
    
    // publicUrl is already returned from uploadToR2 for public uploads
    
    // Update track record if trackId provided
    if (trackId) {
      // Always set storage_url - for public uploads use publicUrl, for private use a placeholder that track-url can handle
      const storageUrl = publicUrl || `r2-private://${key}`
      
      const updateData = {
        storage_type: 'r2',
        storage_key: key,
        storage_url: storageUrl
      }
      
      const { error: updateError } = await supabase
        .from('tracks')
        .update(updateData)
        .eq('id', trackId)
        .eq('created_by', user.id) // Ensure only track owner can update
      
      if (updateError) {
        console.error('Failed to update track:', updateError)
        throw new Error(`Failed to update track: ${updateError.message}`)
      }
    }
    
    // Log successful upload
    await supabase.rpc('log_security_event', {
      p_event_type: 'r2_file_upload_success',
      p_event_details: {
        file_name: fileName,
        storage_key: key,
        bucket_name: bucketName,
        track_id: trackId
      },
      p_user_id: user.id
    })
    
    return new Response(
      JSON.stringify({
        success: true,
        storageKey: key,
        publicUrl,
        bucketName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error('R2 upload error:', error)
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