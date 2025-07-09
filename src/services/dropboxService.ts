
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
  private readonly redirectUri = `${window.location.origin}/dropbox-callback`;

  async authenticate(): Promise<void> {
    console.log('=== STARTING DROPBOX AUTHENTICATION ===');
    console.log('Current URL:', window.location.href);
    console.log('Redirect URI:', this.redirectUri);
    
    // Get Dropbox app key from Supabase secrets
    const { data, error } = await supabase.functions.invoke('get-dropbox-config');
    
    console.log('Supabase config response:', { data, error });
    
    if (error) {
      console.error('Error getting Dropbox config:', error);
      throw new Error('Failed to get Dropbox configuration');
    }
    
    const dropbox_app_key = data?.dropbox_app_key;
    console.log('Dropbox app key:', dropbox_app_key);
    
    if (!dropbox_app_key) {
      throw new Error('Dropbox app key not configured');
    }

    // Add state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropbox_app_key}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}`;
    
    console.log('=== DROPBOX AUTH URL ===');
    console.log('Full auth URL:', authUrl);
    console.log('Encoded redirect URI:', encodeURIComponent(this.redirectUri));
    console.log('State parameter:', state);
    
    // Store state for security verification
    localStorage.setItem('dropbox_auth_state', state);
    
    // Clear any previous browser detection flags
    localStorage.removeItem('brave_detected');
    
    // Simple popup settings that work across browsers
    const popupFeatures = 'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes,status=no';
    
    console.log('=== OPENING DROPBOX AUTH POPUP ===');
    console.log('Popup features:', popupFeatures);
    
    const authWindow = window.open(authUrl, 'dropbox-auth', popupFeatures);
    
    if (!authWindow) {
      console.error('=== FAILED TO OPEN POPUP ===');
      throw new Error('Failed to open authentication popup. Please allow popups for this site.');
    }
    
    console.log('=== POPUP OPENED SUCCESSFULLY ===');
    
    // Enhanced popup monitoring with better error detection
    let checkClosed: any = setInterval(() => {
      try {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          console.log('=== AUTH POPUP CLOSED ===');
          
          // Clean up state
          localStorage.removeItem('dropbox_auth_state');
          
          // Check for token after popup closes
          setTimeout(() => {
            console.log('=== CHECKING FOR TOKEN AFTER POPUP CLOSED ===');
            const token = this.getStoredToken();
            console.log('Found token after popup closed:', token ? 'YES' : 'NO');
            if (token) {
              console.log('=== TOKEN FOUND, AUTH SUCCESSFUL ===');
              // Post success message to parent window
              window.postMessage({ type: 'DROPBOX_AUTH_SUCCESS' }, '*');
            } else {
              console.log('=== NO TOKEN FOUND, AUTH MAY HAVE FAILED ===');
              console.log('This could be due to redirect URI mismatch or other issues');
              // Post error message
              window.postMessage({ 
                type: 'DROPBOX_AUTH_ERROR', 
                error: 'Authentication failed - check Dropbox app redirect URI configuration'
              }, '*');
            }
          }, 1000);
        }
      } catch (error) {
        // Handle cross-origin errors when checking popup status
        console.log('Cross-origin error checking popup status (this is normal):', error);
      }
    }, 1000);

    // Set a timeout to detect if auth is taking too long
    const timeoutId = setTimeout(() => {
      if (!authWindow?.closed) {
        console.log('=== AUTH TAKING LONGER THAN EXPECTED ===');
        console.log('This may indicate redirect URI issues or other problems');
      }
    }, 15000);

    // Clean up timeout when popup closes
    const originalInterval = checkClosed;
    checkClosed = setInterval(() => {
      try {
        if (authWindow?.closed) {
          clearTimeout(timeoutId);
          clearInterval(checkClosed);
          originalInterval();
        }
      } catch (error) {
        // Handle cross-origin errors
      }
    }, 1000);
  }

  async handleAuthCallback(code: string): Promise<void> {
    console.log('=== HANDLING AUTH CALLBACK ===');
    console.log('Authorization code received:', code ? `${code.substring(0, 10)}...` : 'NONE');
    
    // Verify state parameter
    const storedState = localStorage.getItem('dropbox_auth_state');
    console.log('Stored auth state:', storedState);
    
    try {
      const { data, error } = await supabase.functions.invoke('exchange-dropbox-token', {
        body: { code, redirect_uri: this.redirectUri }
      });

      console.log('=== TOKEN EXCHANGE RESPONSE ===', { 
        hasData: !!data, 
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
        errorDetails: error
      });

      if (error) {
        console.error('=== TOKEN EXCHANGE ERROR ===', error);
        throw new Error(`Token exchange failed: ${error.message || 'Unknown error'}`);
      }

      if (data?.access_token) {
        console.log('=== ACCESS TOKEN RECEIVED ===');
        console.log('Token length:', data.access_token.length);
        console.log('Token preview:', `${data.access_token.substring(0, 10)}...`);
        
        this.accessToken = data.access_token;
        localStorage.setItem('dropbox_access_token', data.access_token);
        
        // Verify storage
        const storedToken = localStorage.getItem('dropbox_access_token');
        console.log('=== TOKEN STORAGE VERIFICATION ===');
        console.log('Token stored successfully:', storedToken ? 'YES' : 'NO');
        console.log('Stored token matches:', storedToken === data.access_token ? 'YES' : 'NO');
        
        // Clean up auth state
        localStorage.removeItem('dropbox_auth_state');
        
      } else {
        console.error('=== NO ACCESS TOKEN IN RESPONSE ===');
        console.log('Full response data:', data);
        throw new Error('No access token received from Dropbox');
      }
    } catch (error) {
      console.error('=== TOKEN EXCHANGE EXCEPTION ===', error);
      throw error;
    }
  }

  getStoredToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('dropbox_access_token');
      console.log('Getting stored token from localStorage:', this.accessToken ? 'FOUND' : 'NOT FOUND');
      if (this.accessToken) {
        console.log('Token preview:', `${this.accessToken.substring(0, 10)}...`);
      }
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
    console.log('=== IS AUTHENTICATED CHECK ===', { 
      hasToken: isAuth, 
      tokenPreview: token ? `${token.substring(0, 10)}...` : 'NONE' 
    });
    return isAuth;
  }

  logout(): void {
    console.log('=== LOGGING OUT ===');
    this.accessToken = null;
    localStorage.removeItem('dropbox_access_token');
    localStorage.removeItem('dropbox_auth_state');
    localStorage.removeItem('dropbox_auth_success');
  }
}

export const dropboxService = new DropboxService();
