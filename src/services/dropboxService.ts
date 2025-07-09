
import { supabase } from "@/integrations/supabase/client";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  content_hash?: string;
  ".tag": "file" | "folder";
}

export class DropboxService {
  private accessToken: string | null = null;
  private readonly redirectUri = `${window.location.protocol}//${window.location.host}/dropbox-callback`;

  async authenticate(): Promise<void> {
    console.log('Starting Dropbox authentication...');
    console.log('Current URL:', window.location.href);
    console.log('Redirect URI:', this.redirectUri);
    
    // Get Dropbox app key from Supabase secrets
    const { data, error } = await supabase.functions.invoke('get-dropbox-config');
    
    console.log('Supabase response:', { data, error });
    
    if (error) {
      console.error('Error getting Dropbox config:', error);
      throw new Error('Failed to get Dropbox configuration');
    }
    
    const dropbox_app_key = data?.dropbox_app_key;
    console.log('Dropbox app key:', dropbox_app_key);
    
    if (!dropbox_app_key) {
      throw new Error('Dropbox app key not configured');
    }

    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropbox_app_key}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    console.log('Full auth URL:', authUrl);
    console.log('Encoded redirect URI:', encodeURIComponent(this.redirectUri));
    
    // Open in new window to avoid iframe CSP issues
    console.log('Opening Dropbox auth in new window...');
    const authWindow = window.open(authUrl, 'dropbox-auth', 'width=600,height=700,scrollbars=yes,resizable=yes');
    
    // Listen for the auth callback
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);
        console.log('=== AUTH WINDOW CLOSED ===');
        // Check if we got a token after the window closed
        setTimeout(() => {
          console.log('=== CHECKING FOR TOKEN AFTER WINDOW CLOSED ===');
          const token = this.getStoredToken();
          console.log('Found token after window closed:', token ? 'YES' : 'NO');
        }, 1000);
      }
    }, 1000);
  }

  async handleAuthCallback(code: string): Promise<void> {
    console.log('=== HANDLING AUTH CALLBACK ===');
    console.log('Code received:', code ? `${code.substring(0, 10)}...` : 'NONE');
    
    const { data, error } = await supabase.functions.invoke('exchange-dropbox-token', {
      body: { code, redirect_uri: this.redirectUri }
    });

    console.log('=== TOKEN EXCHANGE RESPONSE ===', { data, error });

    if (data?.access_token) {
      console.log('=== STORING ACCESS TOKEN ===');
      this.accessToken = data.access_token;
      localStorage.setItem('dropbox_access_token', data.access_token);
      console.log('Token stored in localStorage:', localStorage.getItem('dropbox_access_token') ? 'YES' : 'NO');
    } else {
      console.error('=== NO ACCESS TOKEN IN RESPONSE ===');
      throw new Error('No access token received from Dropbox');
    }
  }

  getStoredToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('dropbox_access_token');
      console.log('Getting stored token from localStorage:', this.accessToken ? 'FOUND' : 'NOT FOUND');
    }
    return this.accessToken;
  }

  async listFiles(folder: string = ''): Promise<DropboxFile[]> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    console.log('Listing files in folder:', folder);

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
      const errorText = await response.text();
      console.error('Dropbox API error:', response.status, errorText);
      throw new Error('Failed to list Dropbox files');
    }

    const data = await response.json();
    console.log('Dropbox API response:', data);
    
    // Return all entries (both files and folders)
    return data.entries || [];
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
    const token = this.getStoredToken();
    const isAuth = !!token;
    console.log('=== IS AUTHENTICATED CHECK ===', { hasToken: isAuth, tokenPreview: token ? `${token.substring(0, 10)}...` : 'NONE' });
    return isAuth;
  }

  logout(): void {
    console.log('=== LOGGING OUT ===');
    this.accessToken = null;
    localStorage.removeItem('dropbox_access_token');
  }
}

export const dropboxService = new DropboxService();
