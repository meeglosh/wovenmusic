import { supabase } from "@/integrations/supabase/client";

export class R2StorageService {
  
  /**
   * Transfer a track between public and private buckets via your Cloudflare API
   */
  async transferTrack(trackId: string, makePublic: boolean): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('r2-transfer', {
        body: { 
          trackId, 
          makePublic 
        }
      });

      if (error) {
        throw new Error(`Transfer failed: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('R2 transfer error:', error);
      throw error;
    }
  }

  /**
   * Upload file to R2 via your Cloudflare API
   */
  async uploadFile(file: File, visibility: 'public' | 'private' = 'private'): Promise<{ storage_key: string; url?: string }> {
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('visibility', visibility);
      formData.append('fileName', file.name);

      // Use your Cloudflare Functions API endpoint
      const response = await fetch('/api/process-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return {
        storage_key: data.storage_key,
        url: data.publicUrl || data.url
      };
    } catch (error) {
      console.error('R2 upload error:', error);
      throw error;
    }
  }

  /**
   * Get a playable URL for a track via your Cloudflare API
   */
  async getTrackUrl(trackId: string): Promise<string> {
    try {
      const response = await fetch(`/api/track-url?id=${encodeURIComponent(trackId)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get track URL: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data.url;
    } catch (error) {
      console.error('Get track URL error:', error);
      throw error;
    }
  }

  /**
   * Get image URL from storage key via your Cloudflare CDN
   */
  getImageUrl(storageKey: string): string {
    if (!storageKey) return '';
    
    // Use your images CDN
    const cleanKey = storageKey.replace(/^images\//, '');
    return `https://images.wovenmusic.app/images/${encodeURIComponent(cleanKey)}`;
  }
}

export const r2StorageService = new R2StorageService();