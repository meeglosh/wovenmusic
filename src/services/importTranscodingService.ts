import { supabase } from '@/integrations/supabase/client';

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string): Promise<string> {
    console.log('Starting server-side transcode for:', fileName);
    
    try {
      // Use the edge function for server-side FFmpeg transcoding
      console.log('Calling FFmpeg transcoding edge function...');
      
      const { data, error } = await supabase.functions.invoke('transcode-audio', {
        body: {
          audioUrl,
          fileName
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(`Transcoding failed: ${error.message}`);
      }
      
      if (!data.success) {
        console.error('Transcoding failed:', data.error);
        throw new Error(`Transcoding failed: ${data.error}`);
      }
      
      console.log('Server-side transcoding completed successfully');
      console.log('Transcoded file available at:', data.publicUrl);
      console.log('Original size:', data.originalSize, 'bytes');
      console.log('Transcoded size:', data.transcodedSize, 'bytes');
      
      return data.publicUrl;
      
    } catch (error) {
      console.error('Failed to transcode and store audio:', error);
      throw error;
    }
  }
  
  needsTranscoding(filePath: string): boolean {
    // No files need transcoding since .aif files are now blocked
    // and all other supported formats (.wav, .mp3, etc.) play natively
    return false;
  }
}

export const importTranscodingService = new ImportTranscodingService();