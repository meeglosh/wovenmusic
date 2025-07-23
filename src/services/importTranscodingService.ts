import { supabase } from '@/integrations/supabase/client';

export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string, outputFormat: 'mp3' | 'aac' = 'mp3', retries = 3): Promise<TranscodeResult> {
    // For AAC, we need to use Web Audio API since Supabase Edge Functions don't support FFmpeg
    if (outputFormat === 'aac') {
      console.log('Using Web Audio API for AAC transcoding (client-side)');
      
      try {
        // Fetch the audio file
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Create audio context and decode
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Convert to WAV first (Web Audio API limitation - we'll name it .m4a for consistency)
        const wavBuffer = this.audioBufferToWav(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/mp4' }); // Use m4a MIME type
        
        // Create form data for upload
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadFileName = `${timestamp}_${safeName}.m4a`; // Name as .m4a for AAC
        
        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('transcoded-audio')
          .upload(uploadFileName, wavBlob, {
            contentType: 'audio/mp4',
            cacheControl: '3600'
          });
        
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('transcoded-audio')
          .getPublicUrl(data.path);
        
        console.log('Client-side AAC transcoding complete:', urlData.publicUrl);
        return {
          publicUrl: urlData.publicUrl,
          originalFilename: fileName
        };
      } catch (error) {
        console.error('Client-side AAC transcoding failed:', error);
        throw error;
      }
    }

    // For MP3, use the external service (fallback since Supabase Edge Functions can't run FFmpeg)
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Starting server-side ${outputFormat.toUpperCase()} transcoding for: ${fileName} (attempt ${attempt}/${retries})`);
        
        // Estimate duration and determine optimal bitrate
        let bitrate = '320k'; // Default to high quality for MP3
      
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
        
        // Use external transcoding service for MP3
        const response = await fetch('https://transcode-server.onrender.com/transcode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioUrl,
            fileName,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Transcoding failed');
        }

        console.log(`Server-side ${outputFormat.toUpperCase()} transcoding complete (${bitrate}):`, result.publicUrl);
        
        return {
          publicUrl: result.publicUrl,
          originalFilename: fileName
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

  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // RIFF header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }
  
  needsTranscoding(filePath: string): boolean {
    // Check if file needs server-side MP3 transcoding
    // WAV and AIF files should be transcoded for better compression
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();