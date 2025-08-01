import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
};

interface TranscodeRequest {
  audioUrl: string;
  fileName: string;
  bitrate?: string; // Optional bitrate specification
  outputFormat?: 'mp3' | 'aac'; // Optional output format
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('=== NODE RUNTIME FFMPEG TRANSCODING STARTED ===');
    console.log('Function running on Node.js runtime with FFmpeg support');
    
    const { audioUrl, fileName, bitrate = '320k', outputFormat = 'mp3' }: TranscodeRequest = await req.json();
    console.log('=== TRANSCODING REQUEST DETAILS ===');
    console.log('Transcoding request for:', fileName);
    console.log('Source URL:', audioUrl);
    console.log('Target bitrate:', bitrate);
    console.log('Output format received:', outputFormat);
    console.log('Output format type:', typeof outputFormat);
    console.log('Will use AAC?', outputFormat === 'aac');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download the source audio file
    console.log('Downloading source audio file...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio file: ${audioResponse.status}`);
    }

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioData = new Uint8Array(audioArrayBuffer);
    console.log('Downloaded audio file, size:', audioData.length, 'bytes');

    // Create temporary files for input and output
    const inputPath = `/tmp/input_${Date.now()}.aif`;
    const outputExtension = outputFormat === 'aac' ? 'm4a' : 'mp3';
    const outputPath = `/tmp/output_${Date.now()}.${outputExtension}`;

    // Write input file
    await Deno.writeFile(inputPath, audioData);
    console.log('Wrote input file to:', inputPath);

    // Check if FFmpeg is available
    console.log('Checking FFmpeg availability...');
    try {
      const ffmpegCheck = new Deno.Command('ffmpeg', {
        args: ['-version'],
        stdout: 'piped',
        stderr: 'piped',
      });
      const { code: checkCode } = await ffmpegCheck.output();
      if (checkCode !== 0) {
        throw new Error('FFmpeg not available');
      }
      console.log('FFmpeg is available');
    } catch (error) {
      console.error('FFmpeg not available:', error);
      throw new Error('FFmpeg is not installed in this environment');
    }

    // Run FFmpeg transcoding
    console.log(`Starting FFmpeg transcoding to ${outputFormat.toUpperCase()}...`);
    
    // Configure codec and args based on output format
    const codecArgs = outputFormat === 'aac' 
      ? ['-codec:a', 'aac', '-b:a', bitrate]  // Use built-in AAC encoder
      : ['-codec:a', 'libmp3lame', '-b:a', bitrate];  // Use LAME MP3 encoder
    
    const ffmpegProcess = new Deno.Command('ffmpeg', {
      args: [
        '-i', inputPath,           // Input file
        ...codecArgs,              // Codec and bitrate args
        '-ar', '44100',            // Set sample rate to 44.1kHz
        '-ac', '2',                // Set to stereo
        '-y',                      // Overwrite output file
        outputPath                 // Output file
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stdout, stderr } = await ffmpegProcess.output();
    
    console.log('FFmpeg exit code:', code);
    console.log('FFmpeg stdout:', new TextDecoder().decode(stdout));
    
    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error('FFmpeg stderr:', errorOutput);
      throw new Error(`FFmpeg failed with exit code ${code}: ${errorOutput}`);
    }

    console.log('FFmpeg transcoding completed successfully');

    // Read the transcoded file
    const transcodedData = await Deno.readFile(outputPath);
    console.log('Transcoded file size:', transcodedData.length, 'bytes');

    // Generate storage path
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExtension = outputFormat === 'aac' ? 'm4a' : 'mp3';
    const storagePath = `${timestamp}_${safeName}.${fileExtension}`;

    console.log('Uploading to storage:', storagePath);

    // Upload to Supabase Storage
    const contentType = outputFormat === 'aac' ? 'audio/mp4' : 'audio/mpeg';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('transcoded-audio')
      .upload(storagePath, transcodedData, {
        contentType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    console.log('Upload successful:', uploadData.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('transcoded-audio')
      .getPublicUrl(uploadData.path);

    console.log('Public URL:', urlData.publicUrl);

    // Clean up temporary files
    try {
      await Deno.remove(inputPath);
      await Deno.remove(outputPath);
      console.log('Cleaned up temporary files');
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }

    console.log('=== FFMPEG TRANSCODING COMPLETED ===');

    return new Response(JSON.stringify({ 
      success: true, 
      publicUrl: urlData.publicUrl,
      originalSize: audioData.length,
      transcodedSize: transcodedData.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== FFMPEG TRANSCODING FAILED ===', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);