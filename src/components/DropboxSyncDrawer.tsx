import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { audioMetadataService } from "@/services/audioMetadataService";
import { 
  Cloud, 
  Download, 
  RefreshCw, 
  Folder, 
  ArrowLeft, 
  Check,
  Music,
  Loader2,
  X,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Link,
  Unlink
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import DropboxIcon from "@/components/icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { importTranscodingService } from "@/services/importTranscodingService";
import { FileImportStatus, ImportProgress } from "@/types/fileImport";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  ".tag": "file" | "folder";
  duration?: string;
}

interface DropboxSyncDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPendingTracksChange?: (pendingTracks: import("@/types/music").PendingTrack[]) => void;
}

export const DropboxSyncDrawer = ({ isOpen, onOpenChange, onPendingTracksChange }: DropboxSyncDrawerProps) => {
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [folders, setFolders] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [loadingDurations, setLoadingDurations] = useState<Set<string>>(new Set());
  const [lastAuthError, setLastAuthError] = useState<number>(0);
  const [importProgress, setImportProgress] = useState<ImportProgress>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();
  const queryClient = useQueryClient();

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDurationFromUrl = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      let resolved = false;
      
      const cleanup = (duration?: number) => {
        if (!resolved) {
          resolved = true;
          resolve(duration || 180); // Default 3 minutes if can't extract
        }
      };
      
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          cleanup(audio.duration);
        } else {
          cleanup();
        }
      });
      
      audio.addEventListener('error', () => cleanup());
      audio.addEventListener('canplaythrough', () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          cleanup(audio.duration);
        }
      });
      
      setTimeout(() => cleanup(), 15000);
      
      audio.preload = 'metadata';
      audio.crossOrigin = 'anonymous';
      audio.src = url;
    });
  };

  const getDurationFromDropboxFile = async (file: DropboxFile): Promise<string> => {
    try {
      const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
      
      return new Promise((resolve) => {
        const audio = new Audio();
        let resolved = false;
        
        const cleanup = (duration?: number) => {
          if (!resolved) {
            resolved = true;
            if (duration && !isNaN(duration) && duration > 0) {
              const minutes = Math.floor(duration / 60);
              const seconds = Math.floor(duration % 60);
              const result = `${minutes}:${seconds.toString().padStart(2, '0')}`;
              resolve(result);
            } else {
              const estimatedMinutes = Math.max(1, Math.floor(file.size / (1024 * 1024 * 0.5)));
              resolve(`~${estimatedMinutes}:00`);
            }
          }
        };
        
        audio.addEventListener('loadedmetadata', () => cleanup(audio.duration));
        audio.addEventListener('error', () => cleanup());
        audio.addEventListener('canplaythrough', () => {
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            cleanup(audio.duration);
          }
        });
        
        setTimeout(() => cleanup(), 15000);
        
        audio.preload = 'metadata';
        audio.src = tempUrl;
      });
    } catch (error) {
      console.error('Error getting duration for', file.name, ':', error);
      const estimatedMinutes = Math.max(1, Math.floor(file.size / (1024 * 1024 * 0.5)));
      return `~${estimatedMinutes}:00`;
    }
  };

  const loadFileDuration = async (file: DropboxFile) => {
    if (file.duration) return;
    
    setLoadingDurations(prev => new Set(prev).add(file.path_lower));
    const duration = await getDurationFromDropboxFile(file);
    
    setFiles(prevFiles => 
      prevFiles.map(f => 
        f.path_lower === file.path_lower 
          ? { ...f, duration }
          : f
      )
    );
    
    setLoadingDurations(prev => {
      const newSet = new Set(prev);
      newSet.delete(file.path_lower);
      return newSet;
    });
  };

  const loadFolders = async (path: string = "") => {
    setIsLoading(true);
    try {
      const allItems = await dropboxService.listFiles(path);
      
      const folderItems = allItems.filter(item => item[".tag"] === "folder");
      const musicFiles = allItems.filter(item => {
        if (item[".tag"] !== "file") return false;
        
        const fileName = item.name.toLowerCase();
        const supportedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma', '.aif', '.aiff'];
        return supportedExtensions.some(ext => fileName.endsWith(ext));
      });
       
      setFolders(folderItems);
      setFiles(musicFiles);
      setCurrentPath(path);
      setSelectedFiles(new Set());
      
      // Load durations for all music files
      musicFiles.forEach(file => {
        loadFileDuration(file);
      });
      
    } catch (error) {
      console.error('Error loading folders:', error);
      
      if (error.message === 'DROPBOX_TOKEN_EXPIRED' || error.message === 'DROPBOX_AUTH_REQUIRED' || error.message === 'Not authenticated with Dropbox') {
        const now = Date.now();
        if (now - lastAuthError > 5000) {
          setLastAuthError(now);
          window.dispatchEvent(new CustomEvent('dropboxTokenExpired'));
        }
        
        setFiles([]);
        setFolders([]);
        setCurrentPath("");
        setSelectedFiles(new Set());
        setFolderHistory([]);
        setIsConnected(false);
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to load folders from Dropbox.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folderPath: string) => {
    setFolderHistory([...folderHistory, currentPath]);
    loadFolders(folderPath);
  };

  const navigateBack = () => {
    if (folderHistory.length > 0) {
      const previousPath = folderHistory[folderHistory.length - 1];
      setFolderHistory(folderHistory.slice(0, -1));
      loadFolders(previousPath);
    }
  };

  const handleFileToggle = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(file => file.path_lower)));
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const sortedFolders = [...folders].sort((a, b) => {
    const comparison = a.name.localeCompare(b.name);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const sortedFiles = [...files].sort((a, b) => {
    const comparison = a.name.localeCompare(b.name);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const checkConnection = async () => {
    try {
      const connected = await dropboxService.isAuthenticated();
      setIsConnected(connected);
      return connected;
    } catch (error) {
      setIsConnected(false);
      return false;
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isConnected && isOpen) {
      loadFolders();
    }
  }, [isConnected, isOpen]);

  const getCurrentPathName = () => {
    if (!currentPath) return "Dropbox";
    const parts = currentPath.split("/").filter(Boolean);
    return parts[parts.length - 1] || "Dropbox";
  };

  const processFile = async (file: DropboxFile, fileIndex: number, totalFiles: number): Promise<boolean> => {
    const updateProgress = (status: FileImportStatus['status'], error?: string, progress?: number) => {
      setImportProgress(prev => ({
        ...prev,
        [file.path_lower]: {
          path: file.path_lower,
          name: file.name,
          status,
          error,
          progress
        }
      }));
    };
    
    updateProgress('processing', undefined, 0);
    
    const createTrackWithRetry = async (trackData: any, retries = 3): Promise<boolean> => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`Creating track attempt ${attempt}/${retries} for:`, { 
            title: trackData.title, 
            fileUrl: trackData.fileUrl?.substring(0, 50) + '...',
            attempt 
          });
          
          await addTrackMutation.mutateAsync(trackData);
          console.log(`Successfully created track for ${file.name} on attempt ${attempt}`);
          return true;
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`Track creation attempt ${attempt}/${retries} failed for ${file.name}:`, lastError.message);
          
          if (attempt < retries) {
            const delayMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1s, 2s
            console.log(`Retrying track creation in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      
      console.error(`All ${retries} track creation attempts failed for ${file.name}`);
      throw lastError || new Error('Track creation failed after all retry attempts');
    };

    try {
      console.log(`[${fileIndex}/${totalFiles}] Processing ${file.name}...`);
      
      // Check if this is a file that needs transcoding
      const needsTranscoding = importTranscodingService.needsTranscoding(file.name);
      
      updateProgress('processing', undefined, 20);

      let finalUrl: string;
      let formattedDuration: string;
      let title: string;
      let artist: string;

      if (needsTranscoding) {
        // For files that need transcoding (WAV, AIF)
        console.log(`Transcoding file: ${file.name}`);
        updateProgress('processing', undefined, 30);
        
        // Get temporary URL for download
        const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
        updateProgress('processing', undefined, 40);
        
        // Extract metadata from the original file before transcoding
        const metadata = await audioMetadataService.getBestMetadata(tempUrl, file.name);
        console.log(`Extracted metadata for ${file.name}:`, metadata);
        updateProgress('processing', undefined, 50);
        
        // Get conversion quality setting from localStorage
        const conversionQuality = localStorage.getItem('conversionQuality') || 'mp3-320';
        const outputFormat = conversionQuality === 'aac-320' ? 'aac' : 'mp3';
        
        // Transcode with retry logic built into the service
        const transcodeResult = await importTranscodingService.transcodeAndStore(tempUrl, file.name, outputFormat);
        finalUrl = transcodeResult.publicUrl;
        updateProgress('processing', undefined, 70);
        
        // Get duration with extended timeout for large files
        const duration = metadata.duration || await getDurationFromUrl(finalUrl);
        formattedDuration = formatDuration(duration);
        
        // Sanitize and prepare title with proper fallbacks
        title = transcodeResult.originalFilename?.replace(/\.[^/.]+$/, "") || 
               metadata.title || 
               file.name.replace(/\.[^/.]+$/, "");
        title = title.trim() || "Unknown Track";
        artist = metadata.artist || "Unknown Artist";
        
        console.log(`Successfully transcoded ${file.name} to MP3`);
        
      } else {
        // For other formats, download and store directly
        console.log(`Direct download for: ${file.name}`);
        updateProgress('processing', undefined, 30);
        
        const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
        updateProgress('processing', undefined, 40);
        
        // Extract metadata from filename for non-transcoded files
        const metadata = await audioMetadataService.getBestMetadata(tempUrl, file.name);
        console.log(`Extracted metadata for ${file.name}:`, metadata);
        updateProgress('processing', undefined, 50);
        
        const response = await fetch(tempUrl);
        const blob = await response.blob();
        updateProgress('processing', undefined, 60);
        
        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(fileName, blob, {
            contentType: blob.type || 'audio/mpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('audio-files')
          .getPublicUrl(fileName);

        finalUrl = urlData.publicUrl;
        updateProgress('processing', undefined, 70);

        // Get duration with extended timeout for large files
        const duration = metadata.duration || await getDurationFromUrl(finalUrl);
        formattedDuration = formatDuration(duration);
        
        title = metadata.title || file.name.replace(/\.[^/.]+$/, "");
        artist = metadata.artist || "Unknown Artist";
      }
      
      updateProgress('processing', undefined, 80);

      // Create track data
      const trackData = {
        title: title,
        artist: artist,
        duration: formattedDuration,
        fileUrl: finalUrl,
        dropbox_path: null, // No longer needed since file is permanently stored
        is_public: false,
      };

      console.log("Creating track with:", { 
        title: trackData.title, 
        publicUrl: finalUrl?.substring(0, 50) + '...',
        trackData 
      });
      
      updateProgress('processing', undefined, 90);
      
      // Create track with retry logic
      await createTrackWithRetry(trackData);
      
      updateProgress('success', undefined, 100);
      console.log(`[${fileIndex}/${totalFiles}] Successfully stored ${file.name}`);
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Failed to process ${file.name}:`, errorMessage);
      updateProgress('error', errorMessage);
      return false;
    }
  };


  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Set up message listener BEFORE starting auth
      const handleAuthMessage = (event: MessageEvent) => {
        if (event.data.type === 'DROPBOX_AUTH_SUCCESS') {
          console.log('Received auth success message, refreshing auth state...');
          window.removeEventListener('message', handleAuthMessage);
          
          // Refresh the dropbox service auth state
          dropboxService.refreshAuthState();
          setIsConnecting(false);
          
          // Check connection and load folders
          setTimeout(() => {
            checkConnection().then(connected => {
              if (connected) {
                setIsConnected(true);
                loadFolders();
                toast({
                  title: "Connected",
                  description: "Successfully connected to Dropbox.",
                });
              }
            });
          }, 1000);
        } else if (event.data.type === 'DROPBOX_AUTH_ERROR') {
          console.error('Auth failed:', event.data.error);
          window.removeEventListener('message', handleAuthMessage);
          setIsConnecting(false);
          toast({
            title: "Connection failed",
            description: "Failed to connect to Dropbox. Please try again.",
            variant: "destructive",
          });
        }
      };
      
      window.addEventListener('message', handleAuthMessage);
      
      // Add timeout cleanup to prevent hanging
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handleAuthMessage);
        setIsConnecting(false);
        
        // Check if connection was actually successful despite timeout
        setTimeout(() => {
          checkConnection().then(connected => {
            if (connected) {
              setIsConnected(true);
              loadFolders();
              toast({
                title: "Connected",
                description: "Successfully connected to Dropbox.",
              });
            } else {
              toast({
                title: "Connection failed",
                description: "Failed to connect to Dropbox. Please try again.",
                variant: "destructive",
              });
            }
          });
        }, 500);
      }, 20000); // 20 second timeout
      
      await dropboxService.authenticate();
      
      // Clean up timeout if auth completes normally
      clearTimeout(timeoutId);
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      
      // Double-check connection state before showing error
      setTimeout(() => {
        checkConnection().then(connected => {
          if (connected) {
            setIsConnected(true);
            loadFolders();
            toast({
              title: "Connected",
              description: "Successfully connected to Dropbox.",
            });
          } else {
            toast({
              title: "Connection failed",
              description: "Failed to connect to Dropbox. Please try again.",
              variant: "destructive",
            });
          }
        });
      }, 1000);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Clear auth state
      localStorage.removeItem('dropbox_access_token');
      setIsConnected(false);
      setFolders([]);
      setFiles([]);
      setSelectedFiles(new Set());
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Dropbox.",
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
      toast({
        title: "Disconnect failed",
        description: "Failed to disconnect from Dropbox.",
        variant: "destructive",
      });
    }
  };

  const syncSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to sync.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    let syncedCount = 0;
    const totalFiles = selectedFiles.size;
    
    // Get all selected files
    const selectedFileObjects = files.filter(file => selectedFiles.has(file.path_lower));
    
    // Initialize progress for all selected files
    const initialProgress: ImportProgress = {};
    selectedFileObjects.forEach(file => {
      initialProgress[file.path_lower] = {
        path: file.path_lower,
        name: file.name,
        status: 'pending'
      };
    });
    setImportProgress(initialProgress);

    // Immediately show all tracks as pending in the library
    const pendingTracks = selectedFileObjects.map(file => ({
      id: `pending-${file.path_lower}`,
      title: file.name,
      artist: 'Processing...',
      duration: file.duration || '0:00',
      status: 'processing' as const,
      progress: 0
    }));
    
    if (onPendingTracksChange) {
      onPendingTracksChange(pendingTracks);
    }

    try {
      // Process files sequentially to avoid overwhelming the system
      for (let i = 0; i < selectedFileObjects.length; i++) {
        const file = selectedFileObjects[i];
        const fileIndex = i + 1;
        
        const success = await processFile(file, fileIndex, totalFiles);
        if (success) {
          syncedCount++;
        }
        
        // Update overall progress toast
        toast({
          title: `Import Progress: ${fileIndex}/${totalFiles}`,
          description: `Completed: ${syncedCount}, Failed: ${fileIndex - syncedCount}`,
        });
      }

      // Refresh the tracks list
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      
      const failedCount = totalFiles - syncedCount;
      
      toast({
        title: "Import Complete",
        description: failedCount > 0 
          ? `Successfully imported ${syncedCount} of ${totalFiles} files. ${failedCount} failed - check status below.`
          : `Successfully imported all ${syncedCount} files to your library.`,
        variant: failedCount > 0 ? "destructive" : "default"
      });
      
      if (failedCount === 0) {
        setSelectedFiles(new Set());
        setImportProgress({});
      }
      
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const isAllSelected = files.length > 0 && selectedFiles.size === files.length;
  const isIndeterminate = selectedFiles.size > 0 && selectedFiles.size < files.length;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DropboxIcon className="w-5 h-5 text-primary" />
              <DrawerTitle className="text-lg font-semibold text-primary">Dropbox Sync</DrawerTitle>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 text-primary hover:bg-muted rounded-md transition-colors"
                  title="Toggle sort order"
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => loadFolders(currentPath)}
                  disabled={isLoading}
                  className="p-2 text-primary hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Connection Status and Controls */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-4">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <>
                  <Link className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Connected to Dropbox</span>
                </>
              ) : (
                <>
                  <Unlink className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Not connected to Dropbox</span>
                </>
              )}
            </div>
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="text-primary hover:text-primary/80"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 text-primary hover:text-primary/80"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect to Dropbox'
                )}
              </Button>
            )}
          </div>

          {!isConnected ? (
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <Unlink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Connect to Dropbox to browse your music files</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Navigation breadcrumb */}
              {currentPath && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <Folder className="w-4 h-4" />
                  <span>{currentPath}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={navigateBack}
                    className="ml-auto"
                  >
                    <ArrowLeft className="w-4 w-4 mr-1" />
                    Back
                  </Button>
                </div>
              )}

              {/* Select all checkbox */}
              {files.length > 0 && (
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isAllSelected || isIndeterminate}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">
                      {isAllSelected ? 'Deselect All' : 'Select All'}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {selectedFiles.size} of {files.length} selected
                  </span>
                </div>
              )}

              {/* Folders */}
              {sortedFolders.map((folder) => (
                <div
                  key={folder.path_lower}
                  className="flex items-center p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigateToFolder(folder.path_lower)}
                >
                  <Folder className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                  <span className="font-medium flex-1 truncate text-primary">{folder.name}</span>
                  <div className="text-primary">
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              ))}

              {/* Files */}
              {sortedFiles.map((file) => {
                const isSelected = selectedFiles.has(file.path_lower);
                const isLoadingDuration = loadingDurations.has(file.path_lower);
                const progress = importProgress[file.path_lower];
                const isImported = progress?.status === 'success';
                const isFailed = progress?.status === 'error';

                return (
                  <div
                    key={file.path_lower}
                    className={`flex items-center p-3 rounded-lg border bg-card ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleFileToggle(file.path_lower)}
                      className="mr-3 flex-shrink-0"
                      disabled={isImported}
                    />
                    
                    <div className="flex items-center flex-1 min-w-0">
                      <Music className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-primary">{file.name.replace(/\.[^/.]+$/, "")}</div>
                        <div className="text-sm text-muted-foreground">
                          {isLoadingDuration ? (
                            <span className="flex items-center">
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              Loading...
                            </span>
                          ) : file.duration ? (
                            file.duration
                          ) : (
                            '--:--'
                          )}
                        </div>
                      </div>
                    </div>

                    {isImported && (
                      <div className="flex items-center text-green-600 ml-2">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        <span className="text-sm">Imported</span>
                      </div>
                    )}
                    
                    {isFailed && (
                      <div className="flex items-center text-red-600 ml-2">
                        <X className="w-4 h-4 mr-1" />
                        <span className="text-sm">Failed</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {folders.length === 0 && files.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Folder className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {currentPath ? "This folder is empty" : "Your Dropbox is empty"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        {isConnected && selectedFiles.size > 0 && (
          <div className="border-t p-4">
            <Button
              onClick={syncSelectedFiles}
              className="w-full"
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Import {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};