
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dropboxService } from '@/services/dropboxService';
import { useToast } from '@/hooks/use-toast';

// Helper function to log to both current window and parent window
const crossLog = (message: string, data?: any) => {
  console.log(message, data);
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.console.log(`[POPUP] ${message}`, data);
    }
  } catch (e) {
    // Ignore cross-origin errors
  }
};

const DropboxCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      // Log immediately when component mounts
      crossLog('=== DROPBOX CALLBACK COMPONENT MOUNTED ===');
      crossLog('Window location:', window.location);
      crossLog('Current URL:', window.location.href);
      crossLog('Search params:', window.location.search);
      crossLog('Hash:', window.location.hash);
      crossLog('Pathname:', window.location.pathname);
      
      // Check if we're actually on the callback page
      if (!window.location.pathname.includes('dropbox-callback')) {
        crossLog('=== NOT ON CALLBACK PAGE ===');
        return;
      }
      
      crossLog('=== DROPBOX CALLBACK PAGE LOADED ===');
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const state = urlParams.get('state');

      crossLog('=== URL PARAMS ===', { 
        code: code ? `${code.substring(0, 10)}...` : 'missing', 
        error,
        state,
        allParams: Object.fromEntries(urlParams.entries())
      });

      if (error) {
        crossLog('=== DROPBOX AUTH ERROR ===', error);
        const errorMessage = `Dropbox error: ${error}`;
        crossLog('=== POSTING ERROR TO PARENT ===', errorMessage);
        
        toast({
          title: "Authentication Failed",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Notify parent and close
        if (window.opener) {
          window.opener.postMessage({ type: 'DROPBOX_AUTH_ERROR', error: errorMessage }, '*');
        }
        setTimeout(() => window.close(), 1000);
        return;
      }

      if (code) {
        try {
          crossLog('=== STARTING TOKEN EXCHANGE ===');
          crossLog('Authorization code:', `${code.substring(0, 20)}...`);
          crossLog('State parameter:', state);
          
          // Post success message first since we have the auth code
          crossLog('=== POSTING INITIAL SUCCESS MESSAGE TO PARENT ===');
          if (window.opener) {
            window.opener.postMessage({ type: 'DROPBOX_AUTH_SUCCESS' }, '*');
          }
          
          await dropboxService.handleAuthCallback(code);
          crossLog('=== TOKEN EXCHANGE SUCCESSFUL ===');
          
          toast({
            title: "Connected to Dropbox",
            description: "You can now sync your music files.",
          });
          
          // Set success flag
          localStorage.setItem('dropbox_auth_success', 'true');
          crossLog('=== SET AUTH SUCCESS FLAG ===');
          
          crossLog('=== CLOSING POPUP WINDOW ===');
          setTimeout(() => window.close(), 1000);
        } catch (error) {
          crossLog('=== TOKEN EXCHANGE FAILED ===', error);
          crossLog('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          
          const errorMessage = `Token exchange failed: ${error.message}`;
          crossLog('=== POSTING TOKEN EXCHANGE ERROR TO PARENT ===', errorMessage);
          
          toast({
            title: "Connection Failed",
            description: "Failed to complete Dropbox authentication.",
            variant: "destructive",
          });
          
          // Notify parent of failure
          if (window.opener) {
            window.opener.postMessage({ type: 'DROPBOX_AUTH_ERROR', error: errorMessage }, '*');
          }
          setTimeout(() => window.close(), 1000);
        }
      } else {
        crossLog('=== NO AUTHORIZATION CODE RECEIVED ===');
        crossLog('Full URL:', window.location.href);
        crossLog('Search params:', window.location.search);
        crossLog('Hash:', window.location.hash);
        
        const errorMessage = 'No authorization code received - check redirect URI configuration';
        crossLog('=== POSTING NO CODE ERROR TO PARENT ===', errorMessage);
        
        // Notify parent and close
        if (window.opener) {
          window.opener.postMessage({ type: 'DROPBOX_AUTH_ERROR', error: errorMessage }, '*');
        }
        setTimeout(() => window.close(), 1000);
      }
    };

    // Add a small delay to ensure the page is fully loaded
    const timer = setTimeout(handleCallback, 100);
    
    return () => clearTimeout(timer);
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        <p className="text-muted-foreground">Connecting to Dropbox...</p>
        <p className="text-xs text-muted-foreground mt-2">Processing authorization...</p>
        <p className="text-xs text-muted-foreground mt-1">Check console for details</p>
      </div>
    </div>
  );
};

export default DropboxCallback;
