import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

async function getR2Client() {
  const region = 'auto'
  const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT') ?? ''
  const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID') ?? ''
  const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') ?? ''
  
  return {
    region,
    endpoint,
    accessKeyId,
    secretAccessKey
  }
}

async function uploadToR2(
  bucketName: string,
  key: string,
  fileData: Uint8Array,
  contentType: string
): Promise<string> {
  const r2Config = await getR2Client()
  
  // Create AWS SDK v3 style request
  const url = `${r2Config.endpoint}/${bucketName}/${key}`
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: fileData,
  })
  
  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.statusText}`)
  }
  
  return key
}

async function generateSignedUrl(bucketName: string, key: string, expiresIn = 3600): Promise<string> {
  // For now, return a placeholder - actual signed URL generation would need AWS SDK
  // This will be updated with proper AWS SDK v3 implementation
  const r2Config = await getR2Client()
  return `${r2Config.endpoint}/${bucketName}/${key}?signed=true&expires=${Date.now() + expiresIn * 1000}`
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

    const bucketName = isPublic ? 'wovenmusic-public' : 'wovenmusic-private'
    const key = `tracks/${user.id}/${Date.now()}-${fileName}`
    
    const fileData = new Uint8Array(await file.arrayBuffer())
    
    // Upload to R2
    const uploadedKey = await uploadToR2(bucketName, key, fileData, contentType)
    
    let publicUrl = null
    if (isPublic) {
      // For public bucket, generate public URL
      const r2Config = await getR2Client()
      publicUrl = `${r2Config.endpoint.replace('//', '//public.')}/wovenmusic-public/${uploadedKey}`
    }
    
    // Update track record if trackId provided
    if (trackId) {
      const updateData = {
        storage_type: 'r2',
        storage_key: uploadedKey,
        ...(publicUrl && { storage_url: publicUrl })
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
        storage_key: uploadedKey,
        bucket_name: bucketName,
        track_id: trackId
      },
      p_user_id: user.id
    })
    
    return new Response(
      JSON.stringify({
        success: true,
        storageKey: uploadedKey,
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