import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { audioMetadataService } from "@/services/audioMetadataService";
import { 
  Download, 
  RefreshCw, 
  Folder, 
  ArrowLeft, 
  Music,
  Loader2,
  X,
  CheckCircle2,
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
import { importTranscodingService } from "@/services/importTranscodingService";
import { FileImportStatus, ImportProgress } from "@/types/fileImport";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

/** Prefer app API base, else fall back to transcode-server */
const APP_API_BASE =
  (import.meta as any)?.env?.VITE_APP_API_BASE ||
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";

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
    if (!seconds || isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDurationFromUrl = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      let settled = false;
      const done = (val?: number) => {
        if (settled) return;
        settled = true;
        resolve(val && !isNaN(val) && val > 0 ? val : 180);
      };
      audio.addEventListener('loadedmetadata', () => done(audio.duration));
      audio.addEventListener('canplaythrough', () => done(audio.duration));
      audio.addEventListener('error', () => done());
      setTimeout(() => done(), 15000);
      audio.preload = 'metadata';
      audio.src = url;
    });
  };

  const getDurationFromDropboxFile = async (file: DropboxFile): Promise<string> => {
    try {
      const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
      const secs = await getDurationFromUrl(tempUrl);
      return formatDuration(secs);
    } catch {
      // very rough size-based fallback (~0.5 MB ≈ 1 minute)
      const estMin = Math.max(1, Math.floor(file.size / (1024 * 1024 * 0.5)));
      return `~${estMin}:00`;
    }
  };

  const loadFileDuration = async (file: DropboxFile) => {
    if (file.duration) return;
    setLoadingDurations(prev => new Set(prev).add(file.path_lower));
    const duration = await getDurationFromDropboxFile(file);
    setFiles(prev =>
      prev.map(f => f.path_lower === file.path_lower ? { ...f, duration } : f)
    );
    setLoadingDurations(prev => {
      const s = new Set(prev);
      s.delete(file.path_lower);
      return s;
    });
  };

  const loadFolders = async (path: string = "") => {
    setIsLoading(true);
    try {
      const allItems = await dropboxService.listFiles(path);
      const folderItems = allItems.filter((i: any) => i[".tag"] === "folder");
      const musicFiles = allItems.filter((i: any) => {
        if (i[".tag"] !== "file") return false;
        const n = i.name.toLowerCase();
        return ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma', '.aif', '.aiff'].some(ext => n.endsWith(ext));
      });
      setFolders(folderItems);
      setFiles(musicFiles);
      setCurrentPath(path);
      setSelectedFiles(new Set());
      musicFiles.forEach(loadFileDuration);
    } catch (error: any) {
      if (
        error?.message === 'DROPBOX_TOKEN_EXPIRED' ||
        error?.message === 'DROPBOX_AUTH_REQUIRED' ||
        error?.message === 'Not authenticated with Dropbox'
      ) {
        const now = Date.now();
        if (now - lastAuthError > 5000) {
          setLastAuthError(now);
          window.dispatchEvent(new CustomEvent('dropboxTokenExpired'));
        }
        setFiles([]); setFolders([]); setCurrentPath("");
        setSelectedFiles(new Set()); setFolderHistory([]); setIsConnected(false);
        return;
      }
      toast({ title: "Error", description: error?.message || "Failed to load folders from Dropbox.", variant: "destructive" });
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
      const prev = folderHistory[folderHistory.length - 1];
      setFolderHistory(folderHistory.slice(0, -1));
      loadFolders(prev);
    }
  };

  const handleFileToggle = (filePath: string) => {
    const ns = new Set(selectedFiles);
    ns.has(filePath) ? ns.delete(filePath) : ns.add(filePath);
    setSelectedFiles(ns);
  };
  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(files.map(f => f.path_lower)));
  };

  const toggleSortOrder = () => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  const sortedFolders = [...folders].sort((a, b) => (sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  const sortedFiles = [...files].sort((a, b) => (sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));

  const checkConnection = async () => {
    try {
      const connected = await dropboxService.isAuthenticated();
      setIsConnected(connected);
      return connected;
    } catch {
      setIsConnected(false);
      return false;
    }
  };

  useEffect(() => {
    if (isOpen) checkConnection();
  }, [isOpen]);

  useEffect(() => {
    if (isConnected && isOpen) loadFolders();
  }, [isConnected, isOpen]);

  /** server-side pipeline for non-transcode inputs (mp3/aac/...) */
  const serverProcessAudio = async (audioUrl: string, fileName: string) => {
    const quality = (localStorage.getItem('conversionQuality') === 'aac-320') ? 'high' : 'standard';
    const res = await fetch(`${APP_API_BASE}/api/process-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ audioUrl, fileName, quality })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`process-audio failed ${res.status}: ${txt}`);
    }
    // { ok, url, storage_type:'r2', storage_key, originalFilename, transcoded, quality }
    return res.json();
  };

  const processFile = async (file: DropboxFile, fileIndex: number, totalFiles: number): Promise<boolean> => {
    const updateProgress = (status: FileImportStatus['status'], error?: string, progress?: number) => {
      setImportProgress(prev => ({
        ...prev,
        [file.path_lower]: { path: file.path_lower, name: file.name, status, error, progress }
      }));
    };

    updateProgress('processing', undefined, 10);

    const createTrackWithRetry = async (trackData: any, retries = 3): Promise<void> => {
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await addTrackMutation.mutateAsync(trackData);
          return;
        } catch (e: any) {
          lastErr = e instanceof Error ? e : new Error(String(e));
          if (attempt < retries) await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        }
      }
      throw lastErr || new Error("Track creation failed");
    };

    try {
      const needsTranscoding = importTranscodingService.needsTranscoding(file.name);
      const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);

      // read some tags first
      const metadata = await audioMetadataService.getBestMetadata(tempUrl, file.name);
      const baseName = file.name.replace(/\.[^/.]+$/, "");

      let result: any;
      updateProgress('processing', undefined, 35);

      if (needsTranscoding) {
        const conv = localStorage.getItem('conversionQuality') || 'mp3-320';
        const outFmt = conv === 'aac-320' ? 'aac' : 'mp3';
        result = await importTranscodingService.transcodeAndStore(tempUrl, file.name, outFmt);
      } else {
        result = await serverProcessAudio(tempUrl, file.name);
      }

      updateProgress('processing', undefined, 65);

      const url: string = result.url || result.publicUrl; // handle both helpers
      const storage_key: string = result.storage_key || result.storageKey || result.key;

      const secs = await getDurationFromUrl(url);
      const duration = formatDuration(secs);

      const title =
        (result.originalFilename?.replace(/\.[^/.]+$/, "") || "").trim() ||
        (metadata.title || "").trim() ||
        baseName ||
        "Unknown Track";

      const artist = (metadata.artist || "Unknown Artist").trim();

      // R2-first track row. Don't persist a public URL.
      const trackData = {
        title,
        artist,
        duration,
        storage_type: 'r2',
        storage_key,
        storage_url: null,
        fileUrl: null,
        dropbox_path: null,
        is_public: false,
      };

      updateProgress('processing', undefined, 85);
      await createTrackWithRetry(trackData);

      updateProgress('success', undefined, 100);
      return true;
    } catch (err: any) {
      updateProgress('error', err?.message || 'Unknown error');
      return false;
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    const isMobileSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
    try {
      const handleAuthMessage = (event: MessageEvent) => {
        if (event.data.type === 'DROPBOX_AUTH_SUCCESS') {
          window.removeEventListener('message', handleAuthMessage);
          setIsConnecting(false);
          setTimeout(() => {
            checkConnection().then(connected => {
              if (connected) {
                setIsConnected(true);
                loadFolders();
                toast({ title: "Connected", description: "Successfully connected to Dropbox." });
              }
            });
          }, 800);
        } else if (event.data.type === 'DROPBOX_AUTH_ERROR') {
          window.removeEventListener('message', handleAuthMessage);
          setIsConnecting(false);
          toast({ title: "Connection failed", description: "Failed to connect to Dropbox.", variant: "destructive" });
        }
      };
      window.addEventListener('message', handleAuthMessage);

      if (isMobileSafari) {
        // redirect OAuth for mobile Safari
        const state = Math.random().toString(36).slice(2);
        localStorage.setItem('dropbox_auth_state', state);
        localStorage.setItem('dropbox_auth_return_url', window.location.href);
        const redirectUri = `${window.location.origin}/dropbox-callback`;
        const { dropbox_app_key } = (await (await fetch("/functions/v1/get-dropbox-config", { method: "POST" })).json()) || {};
        if (!dropbox_app_key) throw new Error("Missing Dropbox app key");
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropbox_app_key}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
        window.location.href = authUrl;
        return;
      }

      const timeout = setTimeout(() => {
        window.removeEventListener('message', handleAuthMessage);
        setIsConnecting(false);
        setTimeout(() => {
          checkConnection().then(connected => {
            if (connected) {
              setIsConnected(true);
              loadFolders();
              toast({ title: "Connected", description: "Successfully connected to Dropbox." });
            } else {
              toast({ title: "Connection failed", description: "Failed to connect to Dropbox.", variant: "destructive" });
            }
          });
        }, 400);
      }, 20000);

      await dropboxService.authenticate();
      clearTimeout(timeout);
    } catch (error) {
      setIsConnecting(false);
      setTimeout(() => {
        checkConnection().then(connected => {
          if (connected) {
            setIsConnected(true);
            loadFolders();
            toast({ title: "Connected", description: "Successfully connected to Dropbox." });
          } else {
            toast({ title: "Connection failed", description: "Failed to connect to Dropbox.", variant: "destructive" });
          }
        });
      }, 800);
    }
  };

  const handleDisconnect = async () => {
    try {
      localStorage.removeItem('dropbox_access_token');
      setIsConnected(false);
      setFolders([]); setFiles([]); setSelectedFiles(new Set());
      toast({ title: "Disconnected", description: "Successfully disconnected from Dropbox." });
    } catch {
      toast({ title: "Disconnect failed", description: "Failed to disconnect from Dropbox.", variant: "destructive" });
    }
  };

  const syncSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      toast({ title: "No files selected", description: "Please select files to sync.", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    let syncedCount = 0;
    const chosen = files.filter(f => selectedFiles.has(f.path_lower));

    // Seed progress + pending list
    const init: ImportProgress = {};
    chosen.forEach(f => { init[f.path_lower] = { path: f.path_lower, name: f.name, status: 'pending' }; });
    setImportProgress(init);

    onPendingTracksChange?.(
      chosen.map(f => ({
        id: `pending-${f.path_lower}`,
        title: f.name,
        artist: 'Processing...',
        duration: f.duration || '0:00',
        status: 'processing' as const,
        progress: 0
      }))
    );

    try {
      for (let i = 0; i < chosen.length; i++) {
        const ok = await processFile(chosen[i], i + 1, chosen.length);
        if (ok) syncedCount++;
        toast({
          title: `Import Progress: ${i + 1}/${chosen.length}`,
          description: `Completed: ${syncedCount}, Failed: ${i + 1 - syncedCount}`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["tracks"] });

      const failed = chosen.length - syncedCount;
      toast({
        title: "Import Complete",
        description: failed > 0
          ? `Successfully imported ${syncedCount} of ${chosen.length}. ${failed} failed.`
          : `Successfully imported all ${syncedCount} file${syncedCount === 1 ? '' : 's'}.`,
        variant: failed > 0 ? "destructive" : "default"
      });

      if (failed === 0) {
        setSelectedFiles(new Set());
        setImportProgress({});
      }
    } catch (e) {
      toast({ title: "Sync Failed", description: "Failed to sync files. Please try again.", variant: "destructive" });
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
                  onClick={toggleSortOrder}
                  className="p-2 text-primary hover:bg-muted rounded-md transition-colors"
                  title="Toggle sort order"
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
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
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-primary hover:text-primary/80">
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting} className="flex items-center gap-2 text-primary hover:text-primary/80">
                {isConnecting ? (<><RefreshCw className="h-4 w-4 animate-spin" />Connecting...</>) : ('Connect to Dropbox')}
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
                  <Button variant="ghost" size="sm" onClick={navigateBack} className="ml-auto">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                </div>
              )}

              {/* Select all */}
              {files.length > 0 && (
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isAllSelected || isIndeterminate}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium text-primary">
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
                    className={`flex items-center p-3 rounded-lg border bg-card ${isSelected ? 'ring-2 ring-primary' : ''}`}
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
                        <div className="font-medium truncate text-primary">
                          {file.name.replace(/\.[^/.]+$/, "")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {isLoadingDuration ? (
                            <span className="flex items-center">
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              Loading...
                            </span>
                          ) : file.duration ? file.duration : '--:--'}
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
            <Button onClick={syncSelectedFiles} className="w-full" disabled={isSyncing}>
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
