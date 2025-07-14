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
import DropboxIcon from "@/components/icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import { useQueryClient } from "@tanstack/react-query";

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  ".tag": "file" | "folder";
}

interface DropboxSyncAccordionProps {
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export const DropboxSyncAccordion = ({ isExpanded = false, onExpandedChange }: DropboxSyncAccordionProps) => {
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [folders, setFolders] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();
  const queryClient = useQueryClient();

  const sortItems = (items: DropboxFile[]) => {
    return [...items].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? comparison : -comparison;
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

    try {
      const selectedFileObjects = files.filter(file => selectedFiles.has(file.path_lower));
      
      for (const file of selectedFileObjects) {
        try {
          // Create track data from Dropbox file
          const trackData = {
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
            artist: "Unknown Artist", // Default artist
            duration: "0:00", // Will be updated when file is played
            fileUrl: "", // Will be populated with Dropbox URL when played
            dropbox_path: file.path_lower,
            is_public: false,
          };
          
          await addTrackMutation.mutateAsync(trackData);
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync ${file.name}:`, error);
        }
      }

      // Refresh the tracks list
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${syncedCount} of ${selectedFiles.size} files.`,
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
                <h4 className="text-sm font-medium">Folders</h4>
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
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">Music Files</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{files.length} files</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="h-7 px-2 text-xs"
                      title={`Sort ${sortOrder === 'asc' ? 'Z-A' : 'A-Z'}`}
                    >
                      {sortOrder === 'asc' ? (
                        <>A-Z <ArrowUp className="w-3 h-3 ml-1" /></>
                      ) : (
                        <>Z-A <ArrowDown className="w-3 h-3 ml-1" /></>
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {files.map((file) => (
                    <div
                      key={file.path_lower}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => handleFileToggle(file.path_lower)}
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        {selectedFiles.has(file.path_lower) ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <Music className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="flex-1 text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  ))}
                </div>

                {selectedFiles.size > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      onClick={syncSelectedFiles}
                      disabled={isSyncing}
                      size="sm"
                      className="flex-1"
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