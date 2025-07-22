import { audioTranscodingService } from './audioTranscodingService';
import { TranscodingFormat } from '@/hooks/useTranscodingPreferences';

export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string, outputFormat: TranscodingFormat = 'mp3', retries = 3): Promise<TranscodeResult> {
    console.log(`Starting client-side ${outputFormat.toUpperCase()} transcoding for: ${fileName}`);
    
    try {
      // Use client-side Web Audio API transcoding
      const transcodedUrl = await audioTranscodingService.transcodeAudio(audioUrl, outputFormat);
      
      console.log(`Client-side ${outputFormat.toUpperCase()} transcoding complete:`, transcodedUrl);
      
      return {
        publicUrl: transcodedUrl,
        originalFilename: fileName
      };
    } catch (error) {
      console.error('Client-side transcoding failed:', error);
      
      if (retries > 0) {
        console.log(`Retrying transcoding... ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.transcodeAndStore(audioUrl, fileName, outputFormat, retries - 1);
      }
      
      throw error;
    }
  }
  
  needsTranscoding(filePath: string): boolean {
    // Check if file needs client-side transcoding
    // WAV and AIF files should be transcoded for better browser compatibility
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();