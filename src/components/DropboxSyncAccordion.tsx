import { useState, useEffect } from "react";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { audioMetadataService } from "@/services/audioMetadataService";
import { 
  Cloud, 
  Download, 
  RefreshCw, 
  Folder, 
  ChevronRight, 
  Check,
  Music,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import DropboxIcon from "@/components/icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { importTranscodingService } from "@/services/importTranscodingService";
import { FileImportStatus, ImportProgress } from "@/types/fileImport";
import { useTranscodingPreferences } from "@/hooks/useTranscodingPreferences";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  ".tag": "file" | "folder";
  duration?: string;
}

interface DropboxSyncAccordionProps {
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onPendingTracksChange?: (pendingTracks: import("@/types/music").PendingTrack[]) => void;
}

export const DropboxSyncAccordion = ({ isExpanded = true, onExpandedChange, onPendingTracksChange }: DropboxSyncAccordionProps) => {
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [folders, setFolders] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loadingDurations, setLoadingDurations] = useState<Set<string>>(new Set());
  const [lastAuthError, setLastAuthError] = useState<number>(0);
  const [importProgress, setImportProgress] = useState<ImportProgress>({});
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();
  const queryClient = useQueryClient();
  const { preferences } = useTranscodingPreferences();

  const sortItems = (items: DropboxFile[]) => {
    return [...items].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const getDurationFromUrl = (url: string): Promise<number> => {
    console.log(`Getting duration from URL: ${url.substring(0, 50)}...`);
    
    return new Promise((resolve) => {
      const audio = new Audio();
      let resolved = false;
      
      const cleanup = (duration?: number) => {
        if (!resolved) {
          resolved = true;
          console.log(`Duration extracted from URL: ${duration || 'fallback to 180'}`);
          resolve(duration || 180); // Default 3 minutes if can't extract
        }
      };
      
      audio.addEventListener('loadedmetadata', () => {
        console.log(`Loadedmetadata from URL: duration = ${audio.duration}`);
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          cleanup(audio.duration);
        } else {
          console.log(`Invalid duration from URL, using fallback`);
          cleanup(); // Use default if duration is invalid
        }
      });
      
      audio.addEventListener('error', (e) => {
        console.log(`Audio error from URL:`, e);
        cleanup();
      });
      
      audio.addEventListener('canplaythrough', () => {
        console.log(`Canplaythrough from URL: duration = ${audio.duration}`);
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          cleanup(audio.duration);
        }
      });
      
      // Set timeout for larger files or slow networks
      setTimeout(() => {
        console.log(`Timeout reached for URL`);
        cleanup();
      }, 15000);
      
      audio.preload = 'metadata';
      audio.crossOrigin = 'anonymous';
      audio.src = url;
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDurationFromDropboxFile = async (file: DropboxFile): Promise<string> => {
    console.log(`Getting duration for Dropbox file: ${file.name}, size: ${file.size}`);
    
    try {
      const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
      console.log(`Got temp URL for ${file.name}: ${tempUrl.substring(0, 50)}...`);
      
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
              console.log(`Duration extracted for ${file.name}: ${result} (${duration}s)`);
              resolve(result);
            } else {
              // Estimate based on file size for unsupported formats
              const estimatedMinutes = Math.max(1, Math.floor(file.size / (1024 * 1024 * 0.5)));
              const result = `~${estimatedMinutes}:00`;
              console.log(`Using estimated duration for ${file.name}: ${result}`);
              resolve(result);
            }
          }
        };
        
        audio.addEventListener('loadedmetadata', () => {
          console.log(`Loadedmetadata for ${file.name}: duration = ${audio.duration}`);
          cleanup(audio.duration);
        });
        
        audio.addEventListener('error', (e) => {
          console.log(`Audio error for ${file.name}:`, e);
          cleanup();
        });
        
        audio.addEventListener('canplaythrough', () => {
          console.log(`Canplaythrough for ${file.name}: duration = ${audio.duration}`);
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            cleanup(audio.duration);
          }
        });
        
        // Timeout for large files
        setTimeout(() => {
          console.log(`Timeout reached for ${file.name}`);
          cleanup();
        }, 15000);
        
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
    if (file.duration) return; // Already loaded
    
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
       
      // Sort both folders and files
      const sortedFolders = sortItems(folderItems);
      const sortedFiles = sortItems(musicFiles);
      
      setFolders(sortedFolders);
      setFiles(sortedFiles);
      setCurrentPath(path);
      setSelectedFiles(new Set());
      
      // Load durations for all music files
      sortedFiles.forEach(file => {
        loadFileDuration(file);
      });
      
    } catch (error) {
      console.error('Error loading folders:', error);
      
      // Handle token expiration specifically
      if (error.message === 'DROPBOX_TOKEN_EXPIRED' || error.message === 'DROPBOX_AUTH_REQUIRED' || error.message === 'Not authenticated with Dropbox') {
        // Debounce auth errors to prevent rapid-fire dialogs
        const now = Date.now();
        if (now - lastAuthError > 5000) { // 5 second debounce
          setLastAuthError(now);
          window.dispatchEvent(new CustomEvent('dropboxTokenExpired'));
        }
        
        // Reset the accordion to show connection state
        setFiles([]);
        setFolders([]);
        setCurrentPath("");
        setSelectedFiles(new Set());
        setFolderHistory([]);
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
      // If all are selected, deselect all
      setSelectedFiles(new Set());
    } else {
      // Select all files
      setSelectedFiles(new Set(files.map(file => file.path_lower)));
    }
  };

  const isAllSelected = files.length > 0 && selectedFiles.size === files.length;
  const isIndeterminate = selectedFiles.size > 0 && selectedFiles.size < files.length;

  const retryFailedImport = async (filePath: string) => {
    const file = files.find(f => f.path_lower === filePath);
    if (!file) return;
    
    // Reset status to pending
    setImportProgress(prev => ({
      ...prev,
      [filePath]: { ...prev[filePath], status: 'pending', error: undefined }
    }));
    
    // Process the single file
    await processFile(file, 1, 1);
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
        
        // Transcode with retry logic built into the service
        const transcodeResult = await importTranscodingService.transcodeAndStore(tempUrl, file.name, preferences.outputFormat);
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
        
        console.log(`Title extraction for transcoded file:`, {
          originalFilename: transcodeResult.originalFilename,
          metadataTitle: metadata.title,
          fileName: file.name,
          finalTitle: title,
          finalArtist: artist
        });
        
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
      
      console.log(`DETAILED TRACK CREATION DEBUG:`, {
        originalFileName: file.name,
        extractedTitle: title,
        trackDataTitle: trackData.title,
        trackDataArtist: trackData.artist,
        fullTrackData: trackData
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
      const failedFiles = Object.values(importProgress).filter(f => f.status === 'error');
      
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

  // Load root folder when accordion is first expanded
  useEffect(() => {
    if (isExpanded && files.length === 0 && folders.length === 0 && !isLoading) {
      loadFolders();
    }
  }, [isExpanded]);

  // Handle auth refresh to reload content with fresh tokens
  useEffect(() => {
    const handleAuthRefresh = () => {
      console.log('Dropbox auth refreshed, reloading folder contents...');
      // Small delay to ensure token is fully updated
      setTimeout(() => {
        if (isExpanded) {
          loadFolders(currentPath);
        }
      }, 500);
    };

    window.addEventListener('dropboxAuthRefreshed', handleAuthRefresh);
    return () => {
      window.removeEventListener('dropboxAuthRefreshed', handleAuthRefresh);
    };
  }, [isExpanded, currentPath]);

  // Re-sort files and folders when sorting order changes
  useEffect(() => {
    if (files.length > 0 || folders.length > 0) {
      setFiles(prevFiles => sortItems(prevFiles));
      setFolders(prevFolders => sortItems(prevFolders));
    }
  }, [sortOrder]);

  // Convert import progress to pending tracks for library display
  useEffect(() => {
    const pendingTracks = Object.values(importProgress)
      .filter(progress => progress.status === 'pending' || progress.status === 'processing' || progress.status === 'error')
      .map(progress => ({
        id: `pending-${progress.path}`,
        title: progress.name.replace(/\.[^/.]+$/, '') || 'Unknown Track', // Remove file extension
        artist: progress.status === 'pending' ? 'Queued...' : 
                progress.status === 'processing' ? 'Processing...' : 'Unknown Artist',
        duration: '--:--',
        status: progress.status === 'pending' ? 'processing' as const :
                progress.status === 'processing' ? 'processing' as const : 'failed' as const,
        error: progress.error,
        progress: progress.progress || 0
      }));
    
    onPendingTracksChange?.(pendingTracks);
  }, [importProgress, onPendingTracksChange]);

  const accordionValue = isExpanded ? "dropbox-sync" : "";

  return (
    <Accordion 
      type="single" 
      value={accordionValue}
      onValueChange={(value) => onExpandedChange?.(value === "dropbox-sync")}
      className="w-full"
    >
      <AccordionItem value="dropbox-sync" className="border rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <DropboxIcon className="w-4 h-4 fill-primary" />
            </div>
            <div className="text-left">
              <div className="font-medium">Dropbox Sync</div>
              <div className="text-sm text-muted-foreground">
                Browse and sync music from your Dropbox
              </div>
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Sorting Controls */}
            {!isLoading && (folders.length > 0 || files.length > 0) && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort all items:</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-8 px-3 text-xs gap-1.5 hover:bg-muted"
                  title={`Currently sorting ${sortOrder === 'asc' ? 'A to Z' : 'Z to A'}. Click to reverse order.`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
                </Button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Folder className="w-4 h-4" />
              <span>{currentPath || "/"}</span>
              {folderHistory.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={navigateBack}
                  className="ml-auto"
                >
                  Back
                </Button>
              )}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading folders...
              </div>
            )}

            {/* Folders */}
            {!isLoading && folders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">Folders</h4>
                  <Badge variant="secondary">{folders.length} folders</Badge>
                </div>
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <div
                      key={folder.path_lower}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => navigateToFolder(folder.path_lower)}
                    >
                      <Folder className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{folder.name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {!isLoading && files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">Music Files</h4>
                  <Badge variant="secondary">{files.length} files</Badge>
                </div>

                {/* Select All Checkbox */}
                <div className="flex items-center gap-2 p-2 border-b border-border">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                    style={{
                      backgroundColor: isIndeterminate ? 'hsl(var(--primary))' : undefined,
                    }}
                  />
                  <span className="text-sm font-medium">
                    {isAllSelected ? 'Deselect All' : isIndeterminate ? `${selectedFiles.size} selected` : 'Select All'}
                  </span>
                  {selectedFiles.size > 0 && (
                    <Badge variant="outline" className="ml-auto">
                      {selectedFiles.size} selected
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {files.map((file) => {
                    const progress = importProgress[file.path_lower];
                    return (
                      <div
                        key={file.path_lower}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => handleFileToggle(file.path_lower)}
                      >
                        <Checkbox
                          checked={selectedFiles.has(file.path_lower)}
                          onCheckedChange={() => handleFileToggle(file.path_lower)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={progress?.status === 'processing'}
                        />
                        <Music className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                            {progress && (
                              <>
                                <span>•</span>
                                <span className={`capitalize ${
                                  progress.status === 'success' ? 'text-green-600' :
                                  progress.status === 'error' ? 'text-red-600' :
                                  progress.status === 'processing' ? 'text-blue-600' :
                                  'text-muted-foreground'
                                }`}>
                                  {progress.status}
                                  {progress.progress && ` (${progress.progress}%)`}
                                </span>
                                {progress.status === 'error' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retryFailedImport(file.path_lower);
                                    }}
                                    className="h-4 px-1 text-xs"
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Retry
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                          {progress?.error && (
                            <div className="text-xs text-red-600 mt-1 truncate" title={progress.error}>
                              {progress.error}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground min-w-[50px] text-right">
                          {progress?.status === 'processing' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : loadingDurations.has(file.path_lower) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            file.duration || "--:--"
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Import Progress Summary */}
                {Object.keys(importProgress).length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">
                      Import Status: {Object.values(importProgress).filter(f => f.status === 'success').length} success, {Object.values(importProgress).filter(f => f.status === 'error').length} failed, {Object.values(importProgress).filter(f => f.status === 'processing').length} processing
                    </div>
                    {Object.values(importProgress).some(f => f.status === 'error') && (
                      <div className="flex gap-2 mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const failedFiles = Object.values(importProgress).filter(f => f.status === 'error');
                            Promise.all(failedFiles.map(f => retryFailedImport(f.path)));
                          }}
                          className="text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry All Failed
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setImportProgress({})}
                          className="text-xs"
                        >
                          Clear Status
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedFiles.size > 0 && (
                  <div className="flex justify-center items-center gap-2 pt-2 border-t">
                    <Button
                      onClick={syncSelectedFiles}
                      disabled={isSyncing}
                      size="sm"
                      className="max-w-[343px]"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Import {selectedFiles.size} file{selectedFiles.size === 1 ? '' : 's'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && files.length === 0 && folders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No music files found in this folder</p>
              </div>
            )}

            {/* Refresh button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadFolders(currentPath)}
                disabled={isLoading}
                className="max-w-[343px]"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};