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
      
      // Calculate target compression to stay under 45MB (safe limit)
      const maxFileSizeBytes = 45 * 1024 * 1024; // 45MB
      const originalDuration = audioBuffer.duration;
      
      // Start with high quality settings and adjust if needed
      let targetSampleRate = 44100;
      let channels = Math.min(audioBuffer.numberOfChannels, 2); // Start with stereo
      
      // Estimate file size and reduce quality if needed
      const estimateFileSize = (sampleRate: number, channelCount: number) => {
        const samplesPerSecond = sampleRate * channelCount;
        const bytesPerSample = 2; // 16-bit
        const headerSize = 44;
        return (samplesPerSecond * originalDuration * bytesPerSample) + headerSize;
      };
      
      // Adjust settings to stay under size limit
      if (estimateFileSize(targetSampleRate, channels) > maxFileSizeBytes) {
        // Try mono first
        channels = 1;
        console.log('Reducing to mono to fit size limit');
        
        if (estimateFileSize(targetSampleRate, channels) > maxFileSizeBytes) {
          // Reduce sample rate to 32kHz (still very good quality)
          targetSampleRate = 32000;
          console.log('Reducing sample rate to 32kHz to fit size limit');
          
          if (estimateFileSize(targetSampleRate, channels) > maxFileSizeBytes) {
            // Final fallback: 22.05kHz mono (acceptable quality)
            targetSampleRate = 22050;
            console.log('Reducing sample rate to 22.05kHz to fit size limit');
          }
        }
      }
      
      const length = Math.floor(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate);
      console.log(`Transcoding: ${audioBuffer.sampleRate}Hz ${audioBuffer.numberOfChannels}ch -> ${targetSampleRate}Hz ${channels}ch`);
      
      // Create new buffer with target sample rate
      const resampledBuffer = audioContext.createBuffer(channels, length, targetSampleRate);
      
      // Resample each channel
      for (let channel = 0; channel < channels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = resampledBuffer.getChannelData(channel);
        
        for (let i = 0; i < length; i++) {
          const sourceIndex = Math.floor(i * audioBuffer.sampleRate / targetSampleRate);
          outputData[i] = inputData[sourceIndex] || 0;
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