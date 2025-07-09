import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Download, RefreshCw, AlertCircle, Folder, ChevronRight, ArrowLeft } from "lucide-react";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [viewMode, setViewMode] = useState<"folder-select" | "file-view">("folder-select");
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();

  useEffect(() => {
    const checkAuthStatus = () => {
      const authStatus = dropboxService.isAuthenticated();
      console.log('Checking Dropbox auth status:', authStatus);
      setIsConnected(authStatus);
      
      // Check for successful auth flag
      const authSuccess = localStorage.getItem('dropbox_auth_success');
      if (authSuccess === 'true') {
        console.log('Found auth success flag, updating state...');
        localStorage.removeItem('dropbox_auth_success');
        setIsConnected(true);
        toast({
          title: "Connected to Dropbox",
          description: "You can now sync your music files.",
        });
      }
    };

    // Initial check
    checkAuthStatus();
    
    // Check for authentication status changes periodically
    const interval = setInterval(checkAuthStatus, 1000);
    
    // Listen for messages from popup window
    const handleMessage = (event: MessageEvent) => {
      console.log('Received message:', event.data);
      if (event.data?.type === 'DROPBOX_AUTH_SUCCESS') {
        console.log('Received auth success message from popup');
        checkAuthStatus();
      }
    };
    
    // Also listen for focus events (when popup closes)
    const handleFocus = () => {
      console.log('Window focused, checking auth status...');
      setTimeout(checkAuthStatus, 500); // Small delay to ensure token is saved
    };
    
    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [toast]);

  const handleConnect = async () => {
    try {
      console.log('=== INITIATING DROPBOX CONNECTION ===');
      await dropboxService.authenticate();
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: "Authentication Error",
        description: "Failed to initiate Dropbox authentication.",
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
        <Button onClick={handleConnect}>
          <Cloud className="w-4 h-4 mr-2" />
          Connect Dropbox
        </Button>
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
