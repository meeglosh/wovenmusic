import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Cloud, ExternalLink, Loader2 } from "lucide-react";
import DropboxIcon from "./icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";

interface DropboxConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const DropboxConnectModal = ({ open, onOpenChange, onSuccess }: DropboxConnectModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setIsConnecting(false);
      setConnectionError("");
    }
  }, [open]);

  useEffect(() => {
    const checkAuthStatus = () => {
      const authStatus = dropboxService.isAuthenticated();
      
      if (authStatus && isConnecting) {
        setIsConnecting(false);
        onOpenChange(false);
        onSuccess();
        toast({
          title: "Connected to Dropbox",
          description: "You can now sync your music files.",
        });
      }
      
      // Check for successful auth flag
      const authSuccess = localStorage.getItem('dropbox_auth_success');
      if (authSuccess === 'true') {
        localStorage.removeItem('dropbox_auth_success');
        setIsConnecting(false);
        onOpenChange(false);
        onSuccess();
      }
    };

    if (open && isConnecting) {
      const interval = setInterval(checkAuthStatus, 2000);
      
      // Listen for messages from popup window
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'DROPBOX_AUTH_SUCCESS') {
          if (event.data.token) {
            localStorage.setItem('dropbox_access_token', event.data.token);
          }
          setTimeout(checkAuthStatus, 500);
          setIsConnecting(false);
        } else if (event.data?.type === 'DROPBOX_AUTH_ERROR') {
          setConnectionError(event.data.error || 'Authentication failed');
          setIsConnecting(false);
        }
      };
      
      const handleFocus = () => {
        setTimeout(() => {
          checkAuthStatus();
          if (isConnecting) {
            setIsConnecting(false);
            if (!dropboxService.isAuthenticated()) {
              setConnectionError("Authentication failed - please try again");
            }
          }
        }, 2000);
      };
      
      window.addEventListener('message', handleMessage);
      window.addEventListener('focus', handleFocus);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [open, isConnecting, onOpenChange, onSuccess, toast]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setConnectionError("");
      await dropboxService.authenticate();
      
      // Set a timeout to show error if connection doesn't succeed
      setTimeout(() => {
        if (isConnecting && !dropboxService.isAuthenticated()) {
          setConnectionError("Connection taking longer than expected");
          setIsConnecting(false);
        }
      }, 10000);
    } catch (error) {
      console.error('Authentication error:', error);
      setConnectionError(error.message || "Failed to initiate Dropbox authentication");
      setIsConnecting(false);
      
      toast({
        title: "Authentication Error",
        description: "Failed to initiate Dropbox authentication.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DropboxIcon className="w-6 h-6 fill-primary" />
            Connect to Dropbox
          </DialogTitle>
          <DialogDescription>
            Connect your Dropbox account to sync your music files automatically.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <DropboxIcon className="w-8 h-8 fill-primary" />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-primary">Sync Your Music Library</h3>
              <p className="text-sm text-muted-foreground">
                Access your music files stored in Dropbox and sync them to your library.
              </p>
            </div>
          </div>

          {connectionError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {connectionError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <DropboxIcon className="w-4 h-4 mr-2 fill-current" />
                  Connect to Dropbox
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-primary border-primary hover:bg-primary hover:text-primary-foreground">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};