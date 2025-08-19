import { supabase } from "@/integrations/supabase/client";

export interface R2UploadResult {
  storageKey: string;
  publicUrl?: string;
  bucketName: string;
}

export interface TrackUrlResult {
  fileUrl: string;
  expiresAt?: string;
}

class R2StorageService {
  async uploadFile(
    file: File,
    fileName: string,
    isPublic: boolean,
    trackId?: string
  ): Promise<R2UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    const { data, error } = await supabase.functions.invoke('r2-upload', {
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (error) {
      throw new Error(`R2 upload failed: ${error.message}`);
    }
    
    return data;
  }
  
  async getTrackUrl(trackId: string): Promise<TrackUrlResult> {
    const { data, error } = await supabase.functions.invoke('track-url', {
      body: { trackId },
    });
    
    if (error) {
      throw new Error(`Failed to get track URL: ${error.message}`);
    }
    
    return data;
  }
  
  async transferTrack(trackId: string, newIsPublic: boolean): Promise<void> {
    const { data, error } = await supabase.functions.invoke('r2-transfer', {
      body: { trackId, newIsPublic },
    });
    
    if (error) {
      throw new Error(`Failed to transfer track: ${error.message}`);
    }
    
    return data;
  }
  
  // Check if a track needs to be migrated from Supabase to R2
  needsMigration(track: any): boolean {
    return track.storage_type !== 'r2' && track.file_url && !track.storage_key;
  }
  
  // Migrate existing Supabase storage track to R2
  async migrateTrack(track: any): Promise<R2UploadResult> {
    if (!track.file_url) {
      throw new Error('No file URL to migrate');
    }
    
    try {
      // Download the file from Supabase
      const response = await fetch(track.file_url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const file = new File([blob], `${track.title}.mp3`, { type: 'audio/mpeg' });
      
      // Upload to R2
      const result = await this.uploadFile(file, `${track.title}.mp3`, track.is_public, track.id);
      
      return result;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

export const r2StorageService = new R2StorageService();