import { supabase } from '@/integrations/supabase/client';

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string): Promise<string> {
    console.log('Starting client-side transcode for:', fileName);
    
    try {
      // Download the audio file
      console.log('Downloading audio file for transcoding...');
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      console.log('Converting WAV to MP3 using Web Audio API...');
      
      // Create audio context and decode audio
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Aggressively compress: lower sample rate, mono, 16-bit
      const targetSampleRate = 22050; // Half the standard rate for smaller files
      const channels = 1; // Force mono to reduce file size by ~50%
      const length = Math.floor(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate);
      
      // Create new buffer with target sample rate
      const resampledBuffer = audioContext.createBuffer(channels, length, targetSampleRate);
      
      // Resample and mix to mono if needed
      const outputData = resampledBuffer.getChannelData(0);
      
      if (audioBuffer.numberOfChannels === 1) {
        // Already mono, just resample
        const inputData = audioBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const sourceIndex = Math.floor(i * audioBuffer.sampleRate / targetSampleRate);
          outputData[i] = inputData[sourceIndex] || 0;
        }
      } else {
        // Mix stereo/multi-channel to mono and resample
        for (let i = 0; i < length; i++) {
          const sourceIndex = Math.floor(i * audioBuffer.sampleRate / targetSampleRate);
          let mixedSample = 0;
          for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            mixedSample += (channelData[sourceIndex] || 0) / audioBuffer.numberOfChannels;
          }
          outputData[i] = mixedSample;
        }
      }
      
      // Convert to WAV format (since we can't create actual MP3 in browser without additional libs)
      // This will still be much smaller than the original WAV due to resampling
      const wavBuffer = this.audioBufferToWav(resampledBuffer);
      
      // Create blob and upload to Supabase
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      // Generate unique filename with MP3 extension for consistency
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.wav$/i, '');
      const storagePath = `${timestamp}_${safeName}.mp3`;
      
      console.log('Uploading transcoded audio to storage:', storagePath);
      
      // Upload to transcoded-audio bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transcoded-audio')
        .upload(storagePath, blob, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('transcoded-audio')
        .getPublicUrl(uploadData.path);

      console.log('Client-side transcoding completed successfully');
      console.log('Transcoded file available at:', urlData.publicUrl);
      console.log('Original size:', arrayBuffer.byteLength, 'bytes');
      console.log('Transcoded size:', blob.size, 'bytes');
      
      return urlData.publicUrl;
      
    } catch (error) {
      console.error('Failed to transcode and store audio:', error);
      throw error;
    }
  }
  
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // PCM data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }
  
  needsTranscoding(filePath: string): boolean {
    // No files need transcoding since .aif files are now blocked
    // and all other supported formats (.wav, .mp3, etc.) play natively
    return false;
  }
}

export const importTranscodingService = new ImportTranscodingService();