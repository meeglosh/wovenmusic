import { TranscodingFormat } from '@/hooks/useTranscodingPreferences';

export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  async transcodeAndStore(audioUrl: string, fileName: string, outputFormat: TranscodingFormat = 'mp3'): Promise<TranscodeResult> {
    console.log(`Starting Render server transcoding for: ${fileName}`);
    
    try {
      // Call Render server transcoding endpoint
      const response = await fetch('https://transcode-server.onrender.com/api/transcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl,
          fileName,
          outputFormat: 'mp3', // Force mp3 for now since that was working
          bitrate: '320k'
        })
      });

      if (!response.ok) {
        throw new Error(`Transcoding server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Transcoding response:', data);

      if (!data?.success || !data?.publicUrl) {
        throw new Error('Transcoding server returned invalid response');
      }

      console.log(`Render server transcoding completed for: ${fileName}`);
      return {
        publicUrl: data.publicUrl,
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
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();
