
import { supabase } from "@/integrations/supabase/client";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  content_hash?: string;
}

export class DropboxService {
  private accessToken: string | null = null;
  private readonly redirectUri = window.location.origin + '/dropbox-callback';

  async authenticate(): Promise<void> {
    // Get Dropbox app key from Supabase secrets
    const { data: { dropbox_app_key } } = await supabase.functions.invoke('get-dropbox-config');
    
    if (!dropbox_app_key) {
      throw new Error('Dropbox app key not configured');
    }

    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropbox_app_key}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    window.location.href = authUrl;
  }

  async handleAuthCallback(code: string): Promise<void> {
    const { data } = await supabase.functions.invoke('exchange-dropbox-token', {
      body: { code, redirect_uri: this.redirectUri }
    });

    if (data?.access_token) {
      this.accessToken = data.access_token;
      localStorage.setItem('dropbox_access_token', data.access_token);
    }
  }

  getStoredToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('dropbox_access_token');
    }
    return this.accessToken;
  }

  async listFiles(folder: string = ''): Promise<DropboxFile[]> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: folder || '',
        recursive: false,
        include_media_info: true
      })
    });

    if (!response.ok) {
      throw new Error('Failed to list Dropbox files');
    }

    const data = await response.json();
    return data.entries.filter((entry: any) => 
      entry['.tag'] === 'file' && 
      (entry.name.endsWith('.mp3') || entry.name.endsWith('.wav') || entry.name.endsWith('.m4a'))
    );
  }

  async downloadFile(path: string): Promise<Blob> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path })
      }
    });

    if (!response.ok) {
      throw new Error('Failed to download file from Dropbox');
    }

    return response.blob();
  }

  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  logout(): void {
    this.accessToken = null;
    localStorage.removeItem('dropbox_access_token');
  }
}

export const dropboxService = new DropboxService();
