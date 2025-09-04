import { supabase } from "@/integrations/supabase/client";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  content_hash?: string;
  ".tag": "file" | "folder";
}

// Helper function for cross-window logging
const crossLog = (message: string, data?: any) => {
  console.log(message, data);
  if (typeof window !== 'undefined') {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.console.log(`[POPUP] ${message}`, data);
      }
    } catch (e) {
      // Ignore cross-origin errors
    }
  }
};

export class DropboxService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private isAuthenticating: boolean = false;
  private authenticationPromise: Promise<void> | null = null;
  private refreshTimer: any = null;

  private get redirectUri(): string {
    return `${window.location.origin}/dropbox-callback`;
  }

  async authenticate(): Promise<void> {
    // Prevent multiple simultaneous authentication attempts
    if (this.isAuthenticating) {
      console.log('Authentication already in progress...');
      return this.authenticationPromise || Promise.resolve();
    }

    this.isAuthenticating = true;
    this.authenticationPromise = this._performAuthentication();
    
    try {
      await this.authenticationPromise;
    } finally {
      this.isAuthenticating = false;
      this.authenticationPromise = null;
    }
  }

  private async _performAuthentication(): Promise<void> {
    console.log('=== STARTING DROPBOX AUTHENTICATION ===');
    
    const { data, error } = await supabase.functions.invoke('get-dropbox-config');
    
    if (error) {
      console.error('Error getting Dropbox config:', error);
      throw new Error('Failed to get Dropbox configuration');
    }
    
    const dropbox_app_key = data?.dropbox_app_key;
    if (!dropbox_app_key) {
      throw new Error('Dropbox app key not configured');
    }

    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropbox_app_key}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}`;
    
    localStorage.setItem('dropbox_auth_state', state);
    localStorage.removeItem('brave_detected');
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const popupFeatures = isMobile 
      ? 'width=100%,height=100%,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes,status=no'
      : 'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes,status=no';
    
    const authWindow = window.open(authUrl, 'dropbox-auth', popupFeatures);
    
    if (!authWindow) {
      throw new Error(`Failed to open authentication popup. Please allow popups for this site.`);
    }

    const handlePopupMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DROPBOX_AUTH_SUCCESS') {
        clearInterval(checkClosed);
        clearTimeout(timeoutId);
        localStorage.removeItem('dropbox_auth_state');
        
        if (event.data.token) {
          this.accessToken = event.data.token;
          localStorage.setItem('dropbox_access_token', event.data.token);
        }
      } else if (event.data?.type === 'DROPBOX_AUTH_ERROR') {
        clearInterval(checkClosed);
        clearTimeout(timeoutId);
        localStorage.removeItem('dropbox_auth_state');
      }
    };

    window.addEventListener('message', handlePopupMessage);

    let checkClosed: any = setInterval(() => {
      try {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handlePopupMessage);
        }
      } catch (error) {}
    }, 1000);

    const timeoutId = setTimeout(() => {
      if (!authWindow?.closed) {
        console.log('Auth taking longer than expected');
      }
      window.removeEventListener('message', handlePopupMessage);
    }, 15000);
  }

  async handleAuthCallback(code: string): Promise<void> {
    crossLog('=== HANDLING AUTH CALLBACK ===');
    
    const storedState = localStorage.getItem('dropbox_auth_state');
    
    try {
      const { data, error } = await supabase.functions.invoke('exchange-dropbox-token', {
        body: { code, redirect_uri: this.redirectUri }
      });

      if (error) {
        throw new Error(`Token exchange failed: ${error.message}`);
      }

      if (data?.access_token) {
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        
        const expiresIn = data.expires_in || 14400;
        this.tokenExpiresAt = Date.now() + (expiresIn - 1800) * 1000; // 30 min buffer
        
        localStorage.setItem('dropbox_access_token', data.access_token);
        localStorage.setItem('dropbox_refresh_token', data.refresh_token);
        localStorage.setItem('dropbox_token_expires_at', this.tokenExpiresAt.toString());
        
        this.scheduleTokenRefresh();
        localStorage.removeItem('dropbox_auth_state');
      } else {
        throw new Error('No access token received from Dropbox');
      }
    } catch (error) {
      crossLog('=== TOKEN EXCHANGE EXCEPTION ===', error);
      throw error;
    }
  }

  getStoredToken(): string | null {
    const stored = localStorage.getItem('dropbox_access_token');
    const expiresAt = localStorage.getItem('dropbox_token_expires_at');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    
    if (stored && expiresAt && Date.now() > parseInt(expiresAt)) {
      this.logout();
      return null;
    }
    
    this.accessToken = stored;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = expiresAt ? parseInt(expiresAt) : null;
    return stored;
  }

  async listFiles(folder: string = ''): Promise<DropboxFile[]> {
    let token = this.getStoredToken();
    
    if (!token) {
      window.dispatchEvent(new CustomEvent('dropboxAuthRequired'));
      throw new Error('DROPBOX_AUTH_REQUIRED');
    }

    if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt) {
      token = await this.refreshAccessToken();
      if (!token) throw new Error('DROPBOX_TOKEN_EXPIRED');
    }

    let allEntries: DropboxFile[] = [];
    let hasMore = true;
    let cursor: string | undefined;

    try {
      while (hasMore) {
        const requestBody = cursor 
          ? { cursor } 
          : { path: folder || '', recursive: false };
          
        const url = cursor ? 'https://api.dropboxapi.com/2/files/list_folder/continue' : 'https://api.dropboxapi.com/2/files/list_folder';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Dropbox API error: ${response.statusText}`);
        }

        const data = await response.json();
        allEntries.push(...data.entries);
        hasMore = data.has_more;
        cursor = data.cursor;
      }

      return allEntries;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async downloadFile(path: string): Promise<Blob> {
    let token = this.getStoredToken();

    if (!token) {
      window.dispatchEvent(new CustomEvent('dropboxAuthRequired'));
      throw new Error('DROPBOX_AUTH_REQUIRED');
    }

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

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    localStorage.removeItem('dropbox_access_token');
    localStorage.removeItem('dropbox_refresh_token');
    localStorage.removeItem('dropbox_token_expires_at');
    localStorage.removeItem('dropbox_auth_state');
    console.log('Dropbox tokens cleared');
  }

  // Scheduling token refresh
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (this.tokenExpiresAt) {
      const timeUntilRefresh = this.tokenExpiresAt - Date.now() - (10 * 60 * 1000);
      if (timeUntilRefresh > 0) {
        this.refreshTimer = setTimeout(async () => {
          await this.refreshAccessToken();
        }, timeUntilRefresh);
      }
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    
    if (!refreshToken) return null;

    const { data, error } = await supabase.functions.invoke('refresh-dropbox-token', {
      body: { refresh_token: refreshToken }
    });

    if (error) {
      console.error('Token refresh failed:', error);
      this.logout();
      return null;
    }

    if (data?.access_token) {
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || refreshToken;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 1800) * 1000;
      
      localStorage.setItem('dropbox_access_token', data.access_token);
      localStorage.setItem('dropbox_refresh_token', this.refreshToken);
      localStorage.setItem('dropbox_token_expires_at', this.tokenExpiresAt.toString());

      this.scheduleTokenRefresh();
      return data.access_token;
    }

    return null;
  }

  // Add missing methods required by components
  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    return !!token && !this.isTokenExpired();
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false;
    return Date.now() > this.tokenExpiresAt;
  }

  async getAccountInfo(): Promise<any> {
    let token = this.getStoredToken();
    
    if (!token) {
      throw new Error('DROPBOX_AUTH_REQUIRED');
    }

    if (this.isTokenExpired()) {
      token = await this.refreshAccessToken();
      if (!token) throw new Error('DROPBOX_TOKEN_EXPIRED');
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Dropbox API error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  async checkAppPermissions(): Promise<any> {
    let token = this.getStoredToken();
    
    if (!token) {
      throw new Error('DROPBOX_AUTH_REQUIRED');
    }

    if (this.isTokenExpired()) {
      token = await this.refreshAccessToken();
      if (!token) throw new Error('DROPBOX_TOKEN_EXPIRED');
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/2/check/user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Dropbox API error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error checking permissions:', error);
      throw error;
    }
  }

  async getTemporaryLink(path: string): Promise<string> {
    let token = this.getStoredToken();
    
    if (!token) {
      throw new Error('DROPBOX_AUTH_REQUIRED');
    }

    if (this.isTokenExpired()) {
      token = await this.refreshAccessToken();
      if (!token) throw new Error('DROPBOX_TOKEN_EXPIRED');
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path })
      });

      if (!response.ok) {
        throw new Error(`Dropbox API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.link;
    } catch (error) {
      console.error('Error getting temporary link:', error);
      throw error;
    }
  }
}

export const dropboxService = new DropboxService();
