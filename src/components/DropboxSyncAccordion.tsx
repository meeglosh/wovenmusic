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
}

export const DropboxSyncAccordion = ({ isExpanded = true, onExpandedChange }: DropboxSyncAccordionProps) => {
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
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();
  const queryClient = useQueryClient();

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
        const supportedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma'];
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

    try {
      const selectedFileObjects = files.filter(file => selectedFiles.has(file.path_lower));
      
      for (let i = 0; i < selectedFileObjects.length; i++) {
        const file = selectedFileObjects[i];
        const fileIndex = i + 1;
        
        try {
          console.log(`[${fileIndex}/${totalFiles}] Processing ${file.name}...`);
          
          // Check if this is a WAV file that needs transcoding
          const isWavFile = file.name.toLowerCase().endsWith('.wav');
          
          toast({
            title: `Processing ${fileIndex}/${totalFiles}`,
            description: isWavFile 
              ? `Transcoding ${file.name} to MP3 format...`
              : `Downloading and storing ${file.name}...`,
          });

          let finalUrl: string;
          let formattedDuration: string;

          if (isWavFile) {
            // For WAV files, use client-side transcoding to MP3
            console.log(`Transcoding WAV file: ${file.name}`);
            
            // Get temporary URL for download
            const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
            
            // Extract metadata from the original WAV file before transcoding
            const metadata = await audioMetadataService.getBestMetadata(tempUrl, file.name);
            console.log(`Extracted metadata for ${file.name}:`, metadata);
            
            // Transcode client-side and upload to storage
            const transcodeResult = await importTranscodingService.transcodeAndStore(tempUrl, file.name);
            finalUrl = transcodeResult.publicUrl;
            
            // Get duration from the transcoded file or use extracted metadata
            const duration = metadata.duration || await getDurationFromUrl(finalUrl);
            formattedDuration = formatDuration(duration);
            
            console.log(`Successfully transcoded ${file.name} to MP3`);
            
            // Sanitize and prepare title with proper fallbacks
            let title = transcodeResult.originalFilename?.replace(/\.[^/.]+$/, "") || 
                       metadata.title || 
                       file.name.replace(/\.[^/.]+$/, "");
            
            // Remove any extra whitespace and ensure we have a valid title
            title = title.trim() || "Unknown Track";
            
            // Create track data with extracted metadata
            const trackData = {
              title: title,
              artist: metadata.artist || "Unknown Artist",
              duration: formattedDuration,
              fileUrl: finalUrl, // Permanent storage URL (transcoded)
              dropbox_path: null, // No longer needed since file is permanently stored
              is_public: false,
            };

            console.log("Creating track with:", { 
              title: trackData.title, 
              publicUrl: finalUrl, 
              originalFilename: transcodeResult.originalFilename,
              trackData 
            });
            
            await addTrackMutation.mutateAsync(trackData);
          } else {
            // For other formats, download and store directly
            console.log(`Direct download for: ${file.name}`);
            
            const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
            
            // Extract metadata from filename for non-WAV files
            const metadata = await audioMetadataService.getBestMetadata(tempUrl, file.name);
            console.log(`Extracted metadata for ${file.name}:`, metadata);
            
            const response = await fetch(tempUrl);
            const blob = await response.blob();
            
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

            // Get duration from the stored file or use extracted metadata
            const duration = metadata.duration || await getDurationFromUrl(finalUrl);
            formattedDuration = formatDuration(duration);
            
            // Create track data with extracted metadata
            const trackData = {
              title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
              artist: metadata.artist || "Unknown Artist", 
              duration: formattedDuration,
              fileUrl: finalUrl, // Permanent storage URL (direct)
              dropbox_path: null, // No longer needed since file is permanently stored
              is_public: false,
            };
            
            await addTrackMutation.mutateAsync(trackData);
          }
          syncedCount++;
          
          console.log(`[${fileIndex}/${totalFiles}] Successfully stored ${file.name}`);
          
          // Update progress
          toast({
            title: `Progress: ${fileIndex}/${totalFiles} complete`,
            description: `Successfully processed: ${file.name}`,
          });
          
        } catch (error) {
          console.error(`Failed to sync ${file.name}:`, error);
          
          // Show specific error for failed file
          toast({
            title: `Failed to process ${file.name}`,
            description: error.message || "Unknown error occurred",
            variant: "destructive",
          });
        }
      }

      // Refresh the tracks list
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${syncedCount} of ${totalFiles} files to your library.`,
      });
      
      setSelectedFiles(new Set());
      
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
                  {files.map((file) => (
                    <div
                      key={file.path_lower}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => handleFileToggle(file.path_lower)}
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.path_lower)}
                        onCheckedChange={() => handleFileToggle(file.path_lower)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Music className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{file.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {loadingDurations.has(file.path_lower) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>{file.duration || '--:--'}</span>
                        )}
                        <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedFiles.size > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      onClick={syncSelectedFiles}
                      disabled={isSyncing}
                      size="sm"
                      className="flex-1 max-w-[343px]"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Sync {selectedFiles.size} file{selectedFiles.size === 1 ? '' : 's'}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadFolders(currentPath)}
              disabled={isLoading}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};