import { supabase } from '@/integrations/supabase/client';
import { TranscodingFormat } from '@/hooks/useTranscodingPreferences';

export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  async transcodeAndStore(audioUrl: string, fileName: string, outputFormat: TranscodingFormat = 'mp3'): Promise<TranscodeResult> {
    console.log(`Starting client-side transcoding for: ${fileName}`);
    
    try {
      // Fetch the audio file
      const audioResponse = await fetch(audioUrl);
      const audioArrayBuffer = await audioResponse.arrayBuffer();
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
      
      // Convert to WAV format (browser compatible)
      const wavArrayBuffer = this.audioBufferToWav(audioBuffer);
      const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
      
      // Generate filename for storage
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `transcoded/${timestamp}_${safeName}.wav`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transcoded-audio')
        .upload(storagePath, wavBlob, {
          contentType: 'audio/wav',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('transcoded-audio')
        .getPublicUrl(uploadData.path);

      console.log(`Client-side transcoding completed for: ${fileName}`);
      audioContext.close();

      return {
        publicUrl: urlData.publicUrl,
        originalFilename: fileName
      };
    } catch (error: any) {
      console.error(`Transcoding failed for ${fileName}:`, error.message);
      throw new Error(`Transcoding failed: ${error.message}`);
    }
  }

  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // WAV header
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
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const int16Sample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        view.setInt16(offset, int16Sample, true);
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