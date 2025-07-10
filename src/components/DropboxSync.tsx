
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Download, RefreshCw, AlertCircle, Folder, ChevronRight, ArrowLeft, Shield, ExternalLink, Info } from "lucide-react";
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
  const [currentRedirectUri, setCurrentRedirectUri] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [permissionIssue, setPermissionIssue] = useState<boolean>(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [showDetailedDebug, setShowDetailedDebug] = useState(false);
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();

  // Only show privacy browser warning if there's actually an error
  const shouldShowPrivacyWarning = connectionError.includes('blocked') || connectionError.includes('privacy');

  useEffect(() => {
    // Set the current redirect URI when component mounts
    setCurrentRedirectUri(`${window.location.origin}/dropbox-callback`);
  }, []);

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
        
        // If the message includes a token, store it directly
        if (event.data.token) {
          console.log('=== RECEIVED TOKEN FROM POPUP ===');
          console.log('Token preview:', `${event.data.token.substring(0, 10)}...`);
          localStorage.setItem('dropbox_access_token', event.data.token);
          console.log('=== TOKEN STORED IN PARENT WINDOW ===');
        }
        
        setTimeout(checkAuthStatus, 500);
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

  const loadAccountInfo = async () => {
    if (!isConnected) return;
    
    try {
      console.log('Loading account info...');
      const accountData = await dropboxService.getAccountInfo();
      setAccountInfo(accountData);
      
      // Also try to check app permissions
      const appPermissions = await dropboxService.checkAppPermissions();
      console.log('App permissions result:', appPermissions);
      
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const loadFolders = async (path: string = "") => {
    if (!isConnected) {
      console.log('Not connected, skipping folder load');
      return;
    }
    
    console.log('=== LOADING FOLDERS ===');
    console.log('Path:', path);
    console.log('Is authenticated:', dropboxService.isAuthenticated());
    console.log('Token exists:', !!dropboxService.getStoredToken());
    
    setIsLoading(true);
    setDebugInfo("");
    setPermissionIssue(false);
    
    try {
      console.log('Calling dropboxService.listFiles with path:', path);
      const allItems = await dropboxService.listFiles(path);
      console.log('Raw API response:', allItems);
      
      // Enhanced debugging
      const debugDetails = [
        `=== ENHANCED DEBUGGING ===`,
        `Total items returned: ${allItems.length}`,
        `Path queried: "${path}"`,
        `Token preview: ${dropboxService.getStoredToken()?.substring(0, 20)}...`,
        `API call successful: YES`,
        ``,
        `Items breakdown:`
      ];
      
      if (allItems.length === 0) {
        debugDetails.push(`  No items found - this could indicate:`);
        debugDetails.push(`  1. Empty directory`);
        debugDetails.push(`  2. App is in "App folder" mode (sandboxed)`);
        debugDetails.push(`  3. User denied access to files during OAuth`);
        debugDetails.push(`  4. Token has limited scope despite app permissions`);
        debugDetails.push(`  5. Account has no files in root directory`);
        
        // Check if this might be a permission issue
        if (!path) { // Root directory is empty
          setPermissionIssue(true);
          debugDetails.push(`  ⚠️  Root directory access issue detected`);
        }
      } else {
        allItems.forEach((item, index) => {
          debugDetails.push(`  ${index + 1}. ${item.name} (${item[".tag"]}) - Path: ${item.path_lower}`);
        });
      }
      
      setDebugInfo(debugDetails.join('\n'));
      console.log('Debug info:', debugDetails.join('\n'));
      
      const folderItems = allItems.filter(item => item[".tag"] === "folder");
      const musicFiles = allItems.filter(item => 
        item[".tag"] === "file" && 
        (item.name.toLowerCase().endsWith('.mp3') || 
         item.name.toLowerCase().endsWith('.wav') || 
         item.name.toLowerCase().endsWith('.m4a') ||
         item.name.toLowerCase().endsWith('.aif') ||
         item.name.toLowerCase().endsWith('.aiff') ||
         item.name.toLowerCase().endsWith('.flac') ||
         item.name.toLowerCase().endsWith('.aac') ||
         item.name.toLowerCase().endsWith('.ogg') ||
         item.name.toLowerCase().endsWith('.wma'))
      );
      
      console.log('Filtered results:');
      console.log('- Folders:', folderItems.length, folderItems);
      console.log('- Music files:', musicFiles.length, musicFiles);
      
      setFolders(folderItems);
      setFiles(musicFiles);
      setCurrentPath(path);
      
      // Enhanced empty state handling
      if (!path && allItems.length === 0) {
        setPermissionIssue(true);
        toast({
          title: "No items found",
          description: "Your Dropbox appears empty or the app has limited access. Check the debug panel below.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('=== ERROR LOADING FOLDERS ===', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      setDebugInfo(`Error: ${error.message}\nPath: "${path}"\nThis might be a permission or authentication issue.`);
      
      // Show more specific error messages
      let errorMessage = "Failed to load folders from Dropbox.";
      if (error.message?.includes('invalid_access_token')) {
        errorMessage = "Access token expired. Please reconnect to Dropbox.";
        handleDisconnect();
      } else if (error.message?.includes('insufficient_scope') || error.message?.includes('not permitted')) {
        errorMessage = "Insufficient permissions. Please update your Dropbox app permissions and reconnect.";
        setPermissionIssue(true);
      } else if (error.message) {
        errorMessage = `Dropbox API error: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
        
        // Store the Dropbox file path separately for easier retrieval
        const dropboxPath = file.path_lower;
        console.log('Storing Dropbox path for later use:', dropboxPath);
        
        await addTrackMutation.mutateAsync({
          title: title || fileName,
          artist: artist || 'Unknown Artist',
          duration: '--:--', // Will be updated when the track is first played
          fileUrl: dropboxPath,
          source_folder: selectedFolder || currentPath,
          dropbox_path: dropboxPath
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
    setDebugInfo("");
    setAccountInfo(null);
    toast({
      title: "Disconnected",
      description: "Disconnected from Dropbox.",
    });
  };

  useEffect(() => {
    if (isConnected && viewMode === "folder-select") {
      console.log('Connected and in folder-select mode, loading root folders...');
      // Add a small delay to ensure token is fully available
      setTimeout(() => {
        loadFolders("");
        loadAccountInfo(); // Also load account info for debugging
      }, 1000);
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
                <p>Current redirect URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">{currentRedirectUri}</code></p>
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
                  <span className="text-blue-800">Check that your Dropbox app redirect URI matches: <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">{currentRedirectUri}</code></span>
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
          <Button variant="outline" size="sm" onClick={() => setShowDetailedDebug(!showDetailedDebug)}>
            <Info className="w-4 h-4 mr-2" />
            Debug
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </div>

      {/* Account Info Display */}
      {accountInfo && showDetailedDebug && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Account Information:</h4>
          <div className="text-xs text-blue-800 space-y-1">
            <p><strong>Name:</strong> {accountInfo.name?.display_name || 'Unknown'}</p>
            <p><strong>Email:</strong> {accountInfo.email || 'Unknown'}</p>
            <p><strong>Account ID:</strong> {accountInfo.account_id || 'Unknown'}</p>
            <p><strong>Account Type:</strong> {accountInfo.account_type?.['.tag'] || 'Unknown'}</p>
          </div>
        </div>
      )}

      {permissionIssue && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Dropbox Access Issue Detected</span>
          </div>
          <div className="text-sm text-destructive/80 space-y-2">
            <p>Your Dropbox app may have limited access. This can happen if:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Your app is set to "App folder" mode (only accesses a specific folder)</li>
              <li>You denied full access during OAuth authorization</li>
              <li>Your Dropbox account is empty</li>
              <li>There are permission scope issues despite correct app settings</li>
            </ol>
            <p className="mt-2"><strong>Try:</strong></p>
            <ul className="list-disc list-inside ml-2">
              <li>Check if your Dropbox app is set to "Full Dropbox" access mode</li>
              <li>Disconnect and reconnect, granting full access when prompted</li>
              <li>Verify your Dropbox account has files in the root directory</li>
            </ul>
          </div>
        </div>
      )}

      {debugInfo && showDetailedDebug && (
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">Enhanced Debug Information:</h4>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{debugInfo}</pre>
        </div>
      )}

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
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p>This usually means:</p>
                <ul className="list-disc list-inside">
                  <li>Your Dropbox root is empty, or</li>
                  <li>Your app has limited access permissions, or</li>
                  <li>You're in "App folder" mode instead of full Dropbox access</li>
                </ul>
                <p className="mt-2">Check the debug information above for details.</p>
              </div>
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
                Make sure you have audio files (.mp3, .wav, .m4a, .aif, .aiff, .flac, .aac, .ogg, .wma) in the selected folder
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
