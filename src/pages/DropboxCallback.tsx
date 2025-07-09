
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dropboxService } from '@/services/dropboxService';
import { useToast } from '@/hooks/use-toast';

const DropboxCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('Dropbox callback page loaded');
      console.log('Current URL:', window.location.href);
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      console.log('URL params:', { code: code ? 'present' : 'missing', error });

      if (error) {
        console.error('Dropbox auth error:', error);
        toast({
          title: "Authentication Failed",
          description: "Failed to connect to Dropbox. Please try again.",
          variant: "destructive",
        });
        window.close();
        return;
      }

      if (code) {
        try {
          console.log('Exchanging code for token...');
          await dropboxService.handleAuthCallback(code);
          console.log('Token exchange successful');
          
          toast({
            title: "Connected to Dropbox",
            description: "You can now sync your music files.",
          });
          
          // Set a flag to indicate successful authentication
          localStorage.setItem('dropbox_auth_success', 'true');
          
          console.log('Closing popup window...');
          window.close();
        } catch (error) {
          console.error('Token exchange failed:', error);
          toast({
            title: "Connection Failed",
            description: "Failed to complete Dropbox authentication.",
            variant: "destructive",
          });
          window.close();
        }
      } else {
        console.error('No authorization code received');
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
      </div>
    </div>
  );
};

export default DropboxCallback;
