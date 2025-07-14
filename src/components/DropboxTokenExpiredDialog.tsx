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
    try {
      await dropboxService.authenticate();
      
      // Listen for auth success
      const handleAuthSuccess = () => {
        window.removeEventListener('message', handleAuthSuccess);
        setIsReconnecting(false);
        onReconnected?.();
        onClose();
      };
      
      window.addEventListener('message', (event) => {
        if (event.data.type === 'DROPBOX_AUTH_SUCCESS') {
          handleAuthSuccess();
        }
      });
      
    } catch (error) {
      console.error('Reconnection failed:', error);
      setIsReconnecting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <AlertDialogTitle>Dropbox Session Expired</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              Your Dropbox access has expired. This is normal for security reasons 
              and happens periodically.
            </p>
            <p>
              To continue playing your music, please reconnect to Dropbox. 
              This will only take a moment.
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