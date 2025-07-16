import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { dropboxService } from "@/services/dropboxService";

interface DropboxTokenExpiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReconnected?: () => void;
}

export const DropboxTokenExpiredDialog = ({ 
  isOpen, 
  onClose, 
  onReconnected 
}: DropboxTokenExpiredDialogProps) => {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    
    // Set up message listener BEFORE starting auth
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data.type === 'DROPBOX_AUTH_SUCCESS') {
        console.log('Received auth success message, refreshing auth state...');
        window.removeEventListener('message', handleAuthMessage);
        
        // Refresh the dropbox service auth state
        dropboxService.refreshAuthState();
        setIsReconnecting(false);
        
        // Give a longer delay to ensure all services have processed the auth refresh
        setTimeout(() => {
          onReconnected?.();
          onClose();
        }, 1000); // Increased from 500ms to 1000ms
      } else if (event.data.type === 'DROPBOX_AUTH_ERROR') {
        console.error('Auth failed:', event.data.error);
        window.removeEventListener('message', handleAuthMessage);
        setIsReconnecting(false);
      }
    };
    
    window.addEventListener('message', handleAuthMessage);
    
    try {
      await dropboxService.authenticate();
    } catch (error) {
      console.error('Reconnection failed:', error);
      window.removeEventListener('message', handleAuthMessage);
      setIsReconnecting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Dropbox Session Expired</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              Your Dropbox session has expired. This is normal for security 
              reasons and happens periodically.
            </p>
            <p>
              Please reconnect to continue syncing your music files. 
              This will only take a moment and you'll be back to your music.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onClose} disabled={isReconnecting}>
            Not Now
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button 
              onClick={handleReconnect} 
              disabled={isReconnecting}
              className="flex items-center gap-2"
            >
              {isReconnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect to Dropbox
                </>
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};