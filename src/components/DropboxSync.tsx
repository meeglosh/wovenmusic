import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Download, RefreshCw, AlertCircle } from "lucide-react";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
}

const DropboxSync = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();

  useEffect(() => {
    setIsConnected(dropboxService.isAuthenticated());
    
    // Check for authentication status changes periodically
    const checkAuth = () => {
      const wasConnected = isConnected;
      const nowConnected = dropboxService.isAuthenticated();
      if (!wasConnected && nowConnected) {
        setIsConnected(true);
        toast({
          title: "Connected to Dropbox",
          description: "You can now sync your music files.",
        });
      }
    };

    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, [isConnected, toast]);

  const handleConnect = async () => {
    try {
      await dropboxService.authenticate();
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "Failed to initiate Dropbox authentication.",
        variant: "destructive",
      });
    }
  };

  const loadFiles = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const dropboxFiles = await dropboxService.listFiles('/Music');
      setFiles(dropboxFiles);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load files from Dropbox.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
    dropboxService.logout();
    setIsConnected(false);
    setFiles([]);
    toast({
      title: "Disconnected",
      description: "Disconnected from Dropbox.",
    });
  };

  useEffect(() => {
    if (isConnected) {
      loadFiles();
    }
  }, [isConnected]);

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
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={isLoading}>
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
          <p className="text-muted-foreground">Loading files from Dropbox...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No music files found in /Music folder</p>
          <p className="text-sm text-muted-foreground mt-1">
            Make sure you have audio files (.mp3, .wav, .m4a) in your Dropbox /Music folder
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Found {files.length} music file{files.length !== 1 ? 's' : ''} in /Music
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
    </Card>
  );
};

export default DropboxSync;
