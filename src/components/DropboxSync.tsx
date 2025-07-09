import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Download, RefreshCw, AlertCircle, Folder, ChevronRight, ArrowLeft, Shield, ExternalLink } from "lucide-react";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  ".tag": "file" | "folder";
}

const DropboxSync = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [folders, setFolders] = useState<DropboxFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>("");
  const [showBraveHelp, setShowBraveHelp] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [viewMode, setViewMode] = useState<"folder-select" | "file-view">("folder-select");
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();

  // Only show privacy browser warning if there's actually an error
  const shouldShowPrivacyWarning = connectionError.includes('blocked') || connectionError.includes('privacy');

  useEffect(() => {
    const checkAuthStatus = () => {
      const authStatus = dropboxService.isAuthenticated();
      console.log('Auth status check result:', authStatus);
      
      if (authStatus !== isConnected) {
        console.log('Auth status changed from', isConnected, 'to', authStatus);
        setIsConnected(authStatus);
        setConnectionError("");
        
        if (authStatus) {
          toast({
            title: "Connected to Dropbox",
            description: "You can now sync your music files.",
          });
        }
      }
      
      // Check for successful auth flag
      const authSuccess = localStorage.getItem('dropbox_auth_success');
      if (authSuccess === 'true') {
        console.log('Found auth success flag, cleaning up...');
        localStorage.removeItem('dropbox_auth_success');
        setIsConnected(true);
        setConnectionError("");
      }
    };

    // Initial check
    checkAuthStatus();
    
    // Check for authentication status changes
    const interval = setInterval(checkAuthStatus, 2000);
    
    // Listen for messages from popup window
    const handleMessage = (event: MessageEvent) => {
      console.log('Received message from popup:', event.data);
      if (event.data?.type === 'DROPBOX_AUTH_SUCCESS') {
        console.log('Received auth success message, checking status...');
        setTimeout(checkAuthStatus, 1000);
        setIsConnecting(false);
      } else if (event.data?.type === 'DROPBOX_AUTH_ERROR') {
        console.log('Received auth error message:', event.data.error);
        setConnectionError(event.data.error || 'Authentication failed');
        setIsConnecting(false);
        setShowBraveHelp(true);
      }
    };
    
    // Also listen for focus events (when popup closes)
    const handleFocus = () => {
      console.log('Window focused, checking auth status...');
      setTimeout(() => {
        checkAuthStatus();
        if (isConnecting) {
          setIsConnecting(false);
          if (!dropboxService.isAuthenticated()) {
            setConnectionError("Authentication failed - check console for details");
            setShowBraveHelp(true);
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
  }, [toast, isConnected, isConnecting]);

  const handleConnect = async () => {
    try {
      console.log('=== INITIATING DROPBOX CONNECTION ===');
      setIsConnecting(true);
      setConnectionError("");
      setShowBraveHelp(false);
      await dropboxService.authenticate();
      
      // Set a timeout to show help if connection doesn't succeed
      setTimeout(() => {
        if (isConnecting && !dropboxService.isAuthenticated()) {
          setConnectionError("Connection taking longer than expected");
          setShowBraveHelp(true);
          setIsConnecting(false);
        }
      }, 10000);
    } catch (error) {
      console.error('Authentication error:', error);
      setConnectionError(error.message || "Failed to initiate Dropbox authentication");
      setIsConnecting(false);
      
      // Only show privacy help if it seems like a browser blocking issue
      if (error.message?.includes('popup') || error.message?.includes('blocked')) {
        setShowBraveHelp(true);
      }
      
      toast({
        title: "Authentication Error",
        description: "Failed to initiate Dropbox authentication.",
        variant: "destructive",
      });
    }
  };

  const handleManualTokenSubmit = () => {
    if (!manualToken.trim()) {
      toast({
        title: "Invalid Token",
        description: "Please enter a valid access token.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate and store the token
      localStorage.setItem('dropbox_access_token', manualToken.trim());
      setIsConnected(true);
      setManualToken("");
      setShowBraveHelp(false);
      setConnectionError("");
      
      toast({
        title: "Connected to Dropbox",
        description: "Successfully connected using manual token.",
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect with the provided token.",
        variant: "destructive",
      });
    }
  };

  const loadFolders = async (path: string = "") => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      console.log('Loading folders from path:', path);
      const allItems = await dropboxService.listFiles(path);
      const folderItems = allItems.filter(item => item[".tag"] === "folder");
      const musicFiles = allItems.filter(item => 
        item[".tag"] === "file" && 
        (item.name.endsWith('.mp3') || item.name.endsWith('.wav') || item.name.endsWith('.m4a'))
      );
      
      console.log('Found folders:', folderItems.length, 'music files:', musicFiles.length);
      setFolders(folderItems);
      setFiles(musicFiles);
      setCurrentPath(path);
    } catch (error) {
      console.error('Error loading folders:', error);
      toast({
        title: "Error",
        description: "Failed to load folders from Dropbox.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setViewMode("file-view");
    loadFolders(folderPath);
  };

  const handleBackToFolderSelect = () => {
    setViewMode("folder-select");
    setSelectedFolder("");
    setCurrentPath("");
    setFiles([]);
    setFolders([]);
  };

  const navigateToFolder = (folderPath: string) => {
    loadFolders(folderPath);
  };

  const syncFiles = async () => {
    if (!isConnected || files.length === 0) return;
    
    setIsSyncing(true);
    try {
      for (const file of files) {
        // Extract basic info from filename
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        const [title, artist] = fileName.split(' - ');
        
        await addTrackMutation.mutateAsync({
          title: title || fileName,
          artist: artist || 'Unknown Artist',
          duration: '0:00', // We'll need to calculate this from the actual file
          fileUrl: file.path_lower
        });
      }
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${files.length} tracks from Dropbox.`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to sync some files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    console.log('Disconnecting from Dropbox...');
    dropboxService.logout();
    setIsConnected(false);
    setFiles([]);
    setFolders([]);
    setSelectedFolder("");
    setCurrentPath("");
    setViewMode("folder-select");
    setConnectionError("");
    setShowBraveHelp(false);
    toast({
      title: "Disconnected",
      description: "Disconnected from Dropbox.",
    });
  };

  useEffect(() => {
    if (isConnected && viewMode === "folder-select") {
      console.log('Connected and in folder-select mode, loading root folders...');
      loadFolders("");
    }
  }, [isConnected, viewMode]);

  if (!isConnected) {
    return (
      <Card className="p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
          <Cloud className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Connect to Dropbox</h3>
        <p className="text-muted-foreground mb-4">
          Sync your music library with a specific Dropbox folder to automatically import tracks.
        </p>
        
        {connectionError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{connectionError}</span>
            </div>
            {connectionError.includes('redirect_uri') && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>Current redirect URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">{window.location.protocol}//{window.location.host}/dropbox-callback</code></p>
                <p>Make sure this exact URI is configured in your Dropbox app settings.</p>
              </div>
            )}
          </div>
        )}

        {shouldShowPrivacyWarning && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-700 text-sm">
              <Shield className="w-4 h-4" />
              <span>Browser privacy settings may be blocking the connection</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
            <Cloud className="w-4 h-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect Dropbox'}
          </Button>

          {showBraveHelp && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Troubleshooting Connection Issues
              </h4>
              <p className="text-blue-800 text-sm mb-3">
                If you're having trouble connecting, try these options:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-900">1.</span>
                  <span className="text-blue-800">Check that your Dropbox app redirect URI matches: <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">{window.location.protocol}//{window.location.host}/dropbox-callback</code></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-900">2.</span>
                  <span className="text-blue-800">Disable browser shields/privacy protection for this site and try again</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-900">3.</span>
                  <div>
                    <span className="text-blue-800">Or connect manually:</span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-2">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Manual Setup
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Manual Dropbox Connection</DialogTitle>
                          <DialogDescription>
                            Follow these steps to connect manually:
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="text-sm space-y-2">
                            <p><strong>Step 1:</strong> Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Dropbox App Console</a></p>
                            <p><strong>Step 2:</strong> Create a new app or use existing one</p>
                            <p><strong>Step 3:</strong> Generate an access token</p>
                            <p><strong>Step 4:</strong> Paste the token below:</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="manual-token">Access Token</Label>
                            <Input
                              id="manual-token"
                              type="password"
                              placeholder="Paste your Dropbox access token here"
                              value={manualToken}
                              onChange={(e) => setManualToken(e.target.value)}
                            />
                          </div>
                          <Button onClick={handleManualTokenSubmit} className="w-full">
                            Connect with Token
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Cloud className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Dropbox Sync</h3>
          <Badge variant="secondary">Connected</Badge>
          {selectedFolder && (
            <Badge variant="outline" className="max-w-xs truncate">
              {selectedFolder}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {viewMode === "file-view" && (
            <Button variant="outline" size="sm" onClick={handleBackToFolderSelect}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change Folder
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => loadFolders(currentPath)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading from Dropbox...</p>
        </div>
      ) : viewMode === "folder-select" ? (
        <div>
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Choose a folder to sync:</h4>
            {currentPath && (
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                <span>Current path: /{currentPath.replace(/^\//, '')}</span>
              </div>
            )}
          </div>
          
          {folders.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No folders found in this location</p>
              {currentPath && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => loadFolders("")}>
                  Go to Root
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {currentPath && (
                <div 
                  className="flex items-center justify-between p-3 rounded border cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    const parentPath = currentPath.split('/').slice(0, -1).join('/');
                    loadFolders(parentPath);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Folder className="w-4 h-4" />
                    <span className="text-sm">.. (Go back)</span>
                  </div>
                </div>
              )}
              {folders.map((folder) => (
                <div key={folder.path_lower} className="flex items-center justify-between p-3 rounded border">
                  <div className="flex items-center space-x-2">
                    <Folder className="w-4 h-4" />
                    <span className="font-medium text-sm">{folder.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => navigateToFolder(folder.path_lower)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleFolderSelect(folder.path_lower)}>
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No music files found in this folder</p>
              <p className="text-sm text-muted-foreground mt-1">
                Make sure you have audio files (.mp3, .wav, .m4a) in the selected folder
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Found {files.length} music file{files.length !== 1 ? 's' : ''} in selected folder
                </p>
                <Button onClick={syncFiles} disabled={isSyncing || addTrackMutation.isPending}>
                  <Download className="w-4 h-4 mr-2" />
                  {isSyncing ? 'Syncing...' : 'Sync to Library'}
                </Button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {files.map((file) => (
                  <div key={file.path_lower} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {new Date(file.server_modified).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default DropboxSync;
