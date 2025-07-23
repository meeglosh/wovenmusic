import { supabase } from '@/integrations/supabase/client';

export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string, outputFormat: 'mp3' | 'aac' = 'mp3', retries = 3): Promise<TranscodeResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Starting server-side ${outputFormat.toUpperCase()} transcoding for: ${fileName} (attempt ${attempt}/${retries})`);
        
        // Estimate duration and determine optimal bitrate
        let bitrate = '320k'; // Default to high quality for AAC/MP3
      
      try {
        // Quick audio analysis to determine bitrate
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Use Web Audio API to get duration for bitrate estimation
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;
        
        // Estimate file size at 320kbps: duration * bitrate / 8 (convert bits to bytes)  
        const estimated320kbpsSize = duration * 320000 / 8; // ~40KB per second at 320kbps
        
        // If estimated size > 10MB, use 256kbps instead
        if (estimated320kbpsSize > 10 * 1024 * 1024) {
          bitrate = '256k';
          console.log(`Large file detected (${duration.toFixed(1)}s), using 256kbps for compression`);
        } else {
          console.log(`Standard file (${duration.toFixed(1)}s), using 320kbps for high quality`);
        }
        
        audioContext.close();
      } catch (analysisError) {
        console.warn('Could not analyze audio for bitrate selection, using default 320kbps:', analysisError);
      }
      
      // Use Supabase edge function for transcoding with AAC support
      console.log('Sending transcoding request to Supabase edge function:', {
        fileName,
        bitrate,
        outputFormat,
        attempt
      });
      
      const { data: response, error } = await supabase.functions.invoke('transcode-audio', {
        body: {
          audioUrl,
          fileName,
          bitrate,
          outputFormat
        }
      });

      if (error) {
        console.error('Transcoding function error:', error);
        throw new Error(`Transcoding failed: ${error.message}`);
      }

      const data = response;

      if (!data?.publicUrl) {
        throw new Error('No public URL returned from transcoding function');
      }

      console.log(`Server-side ${outputFormat.toUpperCase()} transcoding complete (${bitrate}):`, data.publicUrl);
      if (data.originalSize && data.transcodedSize) {
        const compressionRatio = ((data.originalSize - data.transcodedSize) / data.originalSize * 100).toFixed(1);
        console.log(`Compression: ${(data.originalSize / 1024 / 1024).toFixed(1)}MB → ${(data.transcodedSize / 1024 / 1024).toFixed(1)}MB (${compressionRatio}% reduction)`);
      }
      
      // If the server returned the original filename, log it
      if (data.originalFilename) {
        console.log(`Original filename preserved by transcoding service: ${data.originalFilename}`);
      }
      
      return {
        publicUrl: data.publicUrl,
        originalFilename: data.originalFilename
      };
      
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Transcoding attempt ${attempt}/${retries} failed for ${fileName}:`, lastError.message);
        
        if (attempt < retries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Retrying transcoding in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    console.error(`All ${retries} transcoding attempts failed for ${fileName}`);
    throw lastError || new Error('Transcoding failed after all retry attempts');
  }
  
  needsTranscoding(filePath: string): boolean {
    // Check if file needs server-side MP3 transcoding
    // WAV and AIF files should be transcoded for better compression
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();