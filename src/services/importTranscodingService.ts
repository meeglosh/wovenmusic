import { supabase } from '@/integrations/supabase/client';

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string): Promise<string> {
    try {
      console.log('Starting server-side MP3 transcoding for:', fileName);
      
      // Estimate duration and determine optimal bitrate
      let bitrate = '256k'; // Default to high quality
      
      try {
        // Quick audio analysis to determine bitrate
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Use Web Audio API to get duration for bitrate estimation
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;
        
        // Estimate MP3 file size at 256kbps: duration * bitrate / 8 (convert bits to bytes)
        const estimated256kbpsSize = duration * 256000 / 8; // ~32KB per second at 256kbps
        
        // If estimated size > 10MB, use 128kbps instead
        if (estimated256kbpsSize > 10 * 1024 * 1024) {
          bitrate = '128k';
          console.log(`Large file detected (${duration.toFixed(1)}s), using 128kbps for compression`);
        } else {
          console.log(`Standard file (${duration.toFixed(1)}s), using 256kbps for high quality`);
        }
        
        audioContext.close();
      } catch (analysisError) {
        console.warn('Could not analyze audio for bitrate selection, using default 256kbps:', analysisError);
      }
      
      // TODO: Replace with your external transcoding service URL
      const EXTERNAL_TRANSCODING_URL = 'https://your-transcoding-service.vercel.app/transcode'; // Update this!
      
      const response = await fetch(EXTERNAL_TRANSCODING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          fileName: fileName,
          bitrate: bitrate
        })
      });

      // Log full error details for debugging
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcoding function error:', response.status, response.statusText);
        console.error('Error response body:', errorText);
        throw new Error(`Transcoding failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data?.publicUrl) {
        throw new Error('No public URL returned from transcoding service');
      }

      console.log(`Server-side MP3 transcoding complete (${bitrate}):`, data.publicUrl);
      if (data.originalSize && data.transcodedSize) {
        const compressionRatio = ((data.originalSize - data.transcodedSize) / data.originalSize * 100).toFixed(1);
        console.log(`Compression: ${(data.originalSize / 1024 / 1024).toFixed(1)}MB → ${(data.transcodedSize / 1024 / 1024).toFixed(1)}MB (${compressionRatio}% reduction)`);
      }
      
      return data.publicUrl;
    } catch (error) {
      console.error('Failed to transcode and store audio:', error);
      throw error;
    }
  }
  
  needsTranscoding(filePath: string): boolean {
    // Check if file needs server-side MP3 transcoding
    // WAV and AIF files should be transcoded for better compression
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();