
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

  private get redirectUri(): string {
    return `${window.location.origin}/dropbox-callback`;
  }

  async authenticate(): Promise<void> {
    console.log('=== STARTING DROPBOX AUTHENTICATION ===');
    console.log('Current URL:', window.location.href);
    console.log('Window location origin:', window.location.origin);
    console.log('Redirect URI:', this.redirectUri);
    console.log('IMPORTANT: Add this EXACT URL to your Dropbox app settings:', this.redirectUri);
    
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
    
    // Detect mobile browsers
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('Device detection - Is mobile:', isMobile);
    
    // Simple popup settings that work across browsers
    const popupFeatures = isMobile 
      ? 'width=100%,height=100%,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes,status=no'
      : 'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes,status=no';
    
    console.log('=== OPENING DROPBOX AUTH POPUP ===');
    console.log('Popup features:', popupFeatures);
    console.log('Is mobile device:', isMobile);
    
    const authWindow = window.open(authUrl, 'dropbox-auth', popupFeatures);
    
    if (!authWindow) {
      console.error('=== FAILED TO OPEN POPUP ===');
      const mobileMessage = isMobile 
        ? ' On mobile devices, you may need to enable popups and try again, or use the desktop version for initial setup.'
        : '';
      throw new Error(`Failed to open authentication popup. Please allow popups for this site.${mobileMessage}`);
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
    crossLog('=== HANDLING AUTH CALLBACK ===');
    crossLog('Authorization code received:', code ? `${code.substring(0, 6)}...` : 'NONE');
    // Security: Do not log full authorization codes
    
    // Verify state parameter
    const storedState = localStorage.getItem('dropbox_auth_state');
    crossLog('Stored auth state:', storedState);
    
    try {
      crossLog('=== CALLING SUPABASE EDGE FUNCTION ===');
      crossLog('Function name: exchange-dropbox-token');
      crossLog('Redirect URI for token exchange:', this.redirectUri);
      
      const { data, error } = await supabase.functions.invoke('exchange-dropbox-token', {
        body: { code, redirect_uri: this.redirectUri }
      });

      crossLog('=== TOKEN EXCHANGE RESPONSE ===', { 
        hasData: !!data, 
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
        errorDetails: error,
        fullData: data,
        fullError: error
      });

      if (error) {
        crossLog('=== TOKEN EXCHANGE ERROR ===', error);
        crossLog('Error type:', typeof error);
        crossLog('Error properties:', Object.keys(error));
        throw new Error(`Token exchange failed: ${error.message || JSON.stringify(error)}`);
      }

      if (data?.access_token) {
        crossLog('=== ACCESS TOKEN RECEIVED ===');
        crossLog('Token length:', data.access_token.length);
        crossLog('Token preview:', `${data.access_token.substring(0, 6)}...`);
        
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        
        // Calculate expiration time (with 5 minute buffer)
        const expiresIn = data.expires_in || 14400; // Default 4 hours if not provided
        this.tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000; // 5 min buffer
        
        // Store tokens and expiration
        localStorage.setItem('dropbox_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('dropbox_refresh_token', data.refresh_token);
        }
        localStorage.setItem('dropbox_token_expires_at', this.tokenExpiresAt.toString());
        
        // Verify storage
        const storedToken = localStorage.getItem('dropbox_access_token');
        crossLog('=== TOKEN STORAGE VERIFICATION ===');
        crossLog('Token stored successfully:', storedToken ? 'YES' : 'NO');
        crossLog('Stored token matches:', storedToken === data.access_token ? 'YES' : 'NO');
        crossLog('Refresh token stored:', !!data.refresh_token);
        crossLog('Token expires at:', new Date(this.tokenExpiresAt));
        
        // Clean up auth state
        localStorage.removeItem('dropbox_auth_state');
        
      } else {
        crossLog('=== NO ACCESS TOKEN IN RESPONSE ===');
        crossLog('Full response data:', data);
        throw new Error('No access token received from Dropbox');
      }
    } catch (error) {
      crossLog('=== TOKEN EXCHANGE EXCEPTION ===', error);
      crossLog('Exception type:', typeof error);
      crossLog('Exception name:', error.name);
      crossLog('Exception message:', error.message);
      crossLog('Exception stack:', error.stack);
      throw error;
    }
  }

  getStoredToken(): string | null {
    // Always check localStorage directly to avoid instance issues
    const stored = localStorage.getItem('dropbox_access_token');
    const expiresAt = localStorage.getItem('dropbox_token_expires_at');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    
    console.log('Getting stored token from localStorage:', stored ? 'FOUND' : 'NOT FOUND');
    
    if (stored) {
      console.log('Token preview:', `${stored.substring(0, 6)}...`);
      
      // Check if token is expired
      if (expiresAt && Date.now() > parseInt(expiresAt)) {
        console.log('=== TOKEN EXPIRED ===');
        console.log('Expired at:', new Date(parseInt(expiresAt)));
        console.log('Current time:', new Date());
        
        if (refreshToken) {
          console.log('Refresh token available, will attempt refresh on next API call');
          // Don't clear tokens yet, let the API call handle refresh
        } else {
          console.log('No refresh token available, clearing expired tokens');
          this.logout();
          return null;
        }
      }
      
      this.accessToken = stored; // Update instance cache
      this.refreshToken = refreshToken;
      this.tokenExpiresAt = expiresAt ? parseInt(expiresAt) : null;
    } else {
      this.accessToken = null; // Clear instance cache
      this.refreshToken = null;
      this.tokenExpiresAt = null;
    }
    return stored;
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    
    if (!refreshToken) {
      console.log('No refresh token available');
      return null;
    }

    try {
      console.log('=== REFRESHING DROPBOX TOKEN ===');
      const { data, error } = await supabase.functions.invoke('refresh-dropbox-token', {
        body: { refresh_token: refreshToken }
      });

      if (error) {
        console.error('Token refresh failed:', error);
        this.logout(); // Clear all tokens
        return null;
      }

      if (data?.access_token) {
        console.log('=== TOKEN REFRESH SUCCESSFUL ===');
        
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || refreshToken;
        
        // Calculate new expiration
        const expiresIn = data.expires_in || 14400;
        this.tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000; // 5 min buffer
        
        // Update localStorage
        localStorage.setItem('dropbox_access_token', data.access_token);
        localStorage.setItem('dropbox_refresh_token', this.refreshToken);
        localStorage.setItem('dropbox_token_expires_at', this.tokenExpiresAt.toString());
        
        console.log('New token expires at:', new Date(this.tokenExpiresAt));
        return data.access_token;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.logout(); // Clear all tokens
    }
    
    return null;
  }

  async listFiles(folder: string = ''): Promise<DropboxFile[]> {
    let token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    // Check if token needs refresh
    if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt) {
      console.log('Token expired, attempting refresh...');
      token = await this.refreshAccessToken();
      if (!token) throw new Error('DROPBOX_TOKEN_EXPIRED');
    }

    console.log('=== ENHANCED DROPBOX API DEBUGGING WITH PAGINATION ===');
    console.log('Listing files in folder:', folder);
    console.log('Token exists:', !!token);
    console.log('Token preview:', token ? `${token.substring(0, 6)}...` : 'NONE');

    let allEntries: DropboxFile[] = [];
    let hasMore = true;
    let cursor: string | undefined;

    try {
      while (hasMore) {
        const requestBody = cursor 
          ? { cursor } 
          : {
              path: folder || '',
              recursive: false,
              include_media_info: true,
              include_deleted: false,
              include_has_explicit_shared_members: false
            };

        const url = cursor 
          ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
          : 'https://api.dropboxapi.com/2/files/list_folder';

        console.log('Request URL:', url);
        console.log('Request body:', requestBody);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        console.log('=== DROPBOX API RESPONSE ===');
        console.log('Response status:', response.status);
        console.log('Response status text:', response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('=== DROPBOX API ERROR ===');
          console.error('Status:', response.status);
          console.error('Status text:', response.statusText);
          console.error('Error response body:', errorText);
          
          // Try to parse error response
          try {
            const errorJson = JSON.parse(errorText);
            console.error('Parsed error:', errorJson);
            
            if (errorJson.error && errorJson.error['.tag']) {
              const errorTag = errorJson.error['.tag'];
              console.error('Error tag:', errorTag);
              
              if (errorTag === 'invalid_access_token' || errorTag === 'expired_access_token') {
                // Clear the token and throw specific error
                this.logout();
                throw new Error('DROPBOX_TOKEN_EXPIRED');
              } else if (errorTag === 'insufficient_scope') {
                throw new Error('App permissions are insufficient. Check your Dropbox app permissions.');
              } else {
                throw new Error(`Dropbox API error: ${errorTag} - ${errorJson.error_summary || 'Unknown error'}`);
              }
            }
          } catch (parseError) {
            console.error('Could not parse error response:', parseError);
          }
          
          throw new Error(`Dropbox API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('=== SUCCESSFUL DROPBOX API RESPONSE ===');
        console.log('Response data structure:', Object.keys(data));
        console.log('Has entries:', !!data.entries);
        console.log('Entries count:', data.entries?.length || 0);
        console.log('Has more:', data.has_more);
        console.log('Cursor:', data.cursor);
        console.log('CRITICAL: has_more value and type:', data.has_more, typeof data.has_more);
        console.log('CRITICAL: pagination check - hasMore will be:', data.has_more);
        
        // Add entries from this page
        if (data.entries) {
          allEntries.push(...data.entries);
          console.log(`Added ${data.entries.length} entries. Total so far: ${allEntries.length}`);
        }

        // Check if there are more pages
        hasMore = data.has_more;
        cursor = data.cursor;

        console.log('CRITICAL: After setting hasMore =', hasMore);
        console.log('CRITICAL: Cursor for next page =', cursor);

        if (hasMore) {
          console.log('More entries available, fetching next page...');
        } else {
          console.log('All entries fetched! Final count:', allEntries.length);
        }
      }

      console.log('=== FINAL RESULT ===');
      console.log(`Total entries fetched: ${allEntries.length}`);
      
      if (allEntries.length > 0) {
        console.log('=== ENTRY DETAILS ===');
        allEntries.forEach((entry: any, index: number) => {
          console.log(`Entry ${index + 1}:`, {
            name: entry.name,
            tag: entry['.tag'],
            path_lower: entry.path_lower,
            size: entry.size
          });
        });
      } else {
        console.log('=== NO ENTRIES FOUND ===');
        console.log('This could indicate:');
        console.log('1. Empty Dropbox folder');
        console.log('2. App is sandboxed to a specific folder');
        console.log('3. Permission issues despite having correct scopes');
        console.log('4. User granted limited access during OAuth');
      }
      
      // Return all entries (both files and folders)
      return allEntries;
    } catch (error) {
      console.error('=== DROPBOX API EXCEPTION ===');
      console.error('Error type:', typeof error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Handle token expiration specifically
      if (error.message === 'DROPBOX_TOKEN_EXPIRED') {
        throw error;
      }
      
      throw error;
    }
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

  async getTemporaryLink(path: string): Promise<string> {
    let token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    // Check if token needs refresh
    if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt) {
      console.log('Token expired, attempting refresh...');
      token = await this.refreshAccessToken();
      if (!token) throw new Error('DROPBOX_TOKEN_EXPIRED');
    }

    console.log('Getting temporary link for:', path);

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
        const errorText = await response.text();
        console.error('Temporary link request failed:', response.status, errorText);
        
        // Parse error response to check for expired token
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error['.tag'] === 'expired_access_token') {
            // Try to refresh token first
            console.log('Access token expired, attempting refresh...');
            const newToken = await this.refreshAccessToken();
            if (newToken) {
              // Retry the request with new token
              console.log('Token refreshed, retrying temporary link request...');
              return this.getTemporaryLink(path);
            } else {
              // Clear expired token
              this.logout();
              throw new Error('DROPBOX_TOKEN_EXPIRED');
            }
          }
        } catch (parseError) {
          // If we can't parse, continue with generic error
        }
        
        throw new Error(`Failed to get temporary link: ${errorText}`);
      }

      const data = await response.json();
      console.log('Temporary link response:', data);
      return data.link;
    } catch (error) {
      console.error('Error getting temporary link:', error);
      throw error;
    }
  }

  // Add method to check account info for debugging
  async getAccountInfo(): Promise<any> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    console.log('=== GETTING DROPBOX ACCOUNT INFO ===');
    
    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Account info request failed:', response.status, errorText);
        throw new Error('Failed to get account info');
      }

      const accountData = await response.json();
      console.log('=== ACCOUNT INFO ===', accountData);
      return accountData;
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  // Add method to check app permissions
  async checkAppPermissions(): Promise<any> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    console.log('=== CHECKING APP PERMISSIONS ===');
    
    try {
      const response = await fetch('https://api.dropboxapi.com/2/check/app', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: "list_folder"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('App check request failed:', response.status, errorText);
        return null;
      }

      const appData = await response.json();
      console.log('=== APP PERMISSIONS CHECK ===', appData);
      return appData;
    } catch (error) {
      console.error('Error checking app permissions:', error);
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    const isAuth = !!token;
    
    // Add stack trace to see what's calling this repeatedly
    console.log('=== IS AUTHENTICATED CHECK ===', { 
      hasToken: isAuth, 
      tokenPreview: token ? `${token.substring(0, 10)}...` : 'NONE',
      caller: new Error().stack?.split('\n')[1]?.trim() || 'unknown'
    });
    
    return isAuth;
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
}

export const dropboxService = new DropboxService();
