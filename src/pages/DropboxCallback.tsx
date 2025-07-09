
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dropboxService } from '@/services/dropboxService';
import { useToast } from '@/hooks/use-toast';

const DropboxCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('=== DROPBOX CALLBACK PAGE LOADED ===');
      console.log('Current URL:', window.location.href);
      console.log('Search params:', window.location.search);
      console.log('Hash:', window.location.hash);
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const state = urlParams.get('state');

      console.log('=== URL PARAMS ===', { 
        code: code ? `${code.substring(0, 10)}...` : 'missing', 
        error,
        state
      });

      if (error) {
        console.error('=== DROPBOX AUTH ERROR ===', error);
        toast({
          title: "Authentication Failed",
          description: `Dropbox error: ${error}`,
          variant: "destructive",
        });
        window.close();
        return;
      }

      if (code) {
        try {
          console.log('=== STARTING TOKEN EXCHANGE ===');
          await dropboxService.handleAuthCallback(code);
          console.log('=== TOKEN EXCHANGE SUCCESSFUL ===');
          
          toast({
            title: "Connected to Dropbox",
            description: "You can now sync your music files.",
          });
          
          // Set a flag to indicate successful authentication
          localStorage.setItem('dropbox_auth_success', 'true');
          console.log('=== SET AUTH SUCCESS FLAG ===');
          
          // Try to communicate with parent window
          if (window.opener) {
            console.log('=== POSTING MESSAGE TO PARENT ===');
            window.opener.postMessage({ type: 'DROPBOX_AUTH_SUCCESS' }, '*');
          }
          
          console.log('=== CLOSING POPUP WINDOW ===');
          setTimeout(() => window.close(), 1000);
        } catch (error) {
          console.error('=== TOKEN EXCHANGE FAILED ===', error);
          toast({
            title: "Connection Failed",
            description: "Failed to complete Dropbox authentication.",
            variant: "destructive",
          });
          window.close();
        }
      } else {
        console.error('=== NO AUTHORIZATION CODE RECEIVED ===');
        console.log('URL search params:', window.location.search);
        window.close();
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        <p className="text-muted-foreground">Connecting to Dropbox...</p>
        <p className="text-xs text-muted-foreground mt-2">Check console for details</p>
      </div>
    </div>
  );
};

export default DropboxCallback;
