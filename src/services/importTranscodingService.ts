import { audioTranscodingService } from './audioTranscodingService';
import { supabase } from '@/integrations/supabase/client';

export class ImportTranscodingService {
  
  async transcodeAndStore(audioUrl: string, fileName: string): Promise<string> {
    console.log('Starting transcode and store for:', fileName);
    
    try {
      // Transcode the audio file
      console.log('Transcoding audio file...');
      const transcodedBlobUrl = await audioTranscodingService.transcodeAudio(audioUrl, 'mp3');
      
      // Convert blob URL to actual blob
      const response = await fetch(transcodedBlobUrl);
      const blob = await response.blob();
      
      // Generate a unique filename for storage
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${timestamp}_${safeName}.mp3`;
      
      console.log('Uploading transcoded file to storage:', storagePath);
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transcoded-audio')
        .upload(storagePath, blob, {
          contentType: 'audio/mpeg',
          cacheControl: '3600'
        });
      
      if (uploadError) {
        console.error('Failed to upload transcoded file:', uploadError);
        throw uploadError;
      }
      
      console.log('Successfully uploaded transcoded file:', uploadData.path);
      
      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('transcoded-audio')
        .getPublicUrl(uploadData.path);
      
      console.log('Transcoded file available at:', urlData.publicUrl);
      
      // Clean up the blob URL
      URL.revokeObjectURL(transcodedBlobUrl);
      
      return urlData.publicUrl;
      
    } catch (error) {
      console.error('Failed to transcode and store audio:', error);
      throw error;
    }
  }
  
  needsTranscoding(filePath: string): boolean {
    return audioTranscodingService.needsTranscoding(filePath);
  }
}

export const importTranscodingService = new ImportTranscodingService();