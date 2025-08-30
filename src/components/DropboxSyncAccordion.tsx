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
  RefreshCw, 
  Folder, 
  ChevronRight, 
  Music,
  Loader2,
  ArrowUpDown,
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

/** Prefer app API base, else transcode-server */
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

interface DropboxSyncAccordionProps {
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onPendingTracksChange?: (pendingTracks: import("@/types/music").PendingTrack[]) => void;
}

export const DropboxSyncAccordion = ({ isExpanded = false, onExpandedChange, onPendingTracksChange }: DropboxSyncAccordionProps) => {
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
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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
    return new Promise((resolve) => {
      const audio = new Audio();
      let settled = false;

      const done = (val?: number) => {
        if (settled) return;
        settled = true;
        resolve(val && !isNaN(val) && val > 0 ? val : 180); // default ~3:00
      };

      audio.addEventListener('loadedmetadata', () => done(audio.duration));
      audio.addEventListener('canplaythrough', () => done(audio.duration));
      audio.addEventListener('error', () => done());
      setTimeout(() => done(), 15000);

      audio.preload = 'metadata';
      audio.src = url;
    });
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getTempLinkAndDuration = async (file: DropboxFile): Promise<string> => {
    try {
      const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
      const sec = await getDurationFromUrl(tempUrl);
      return formatDuration(sec);
    } catch {
      // coarse fallback by size (~0.5MB ≈ 1 min heuristic)
      const estMin = Math.max(1, Math.floor(file.size / (1024 * 1024 * 0.5)));
      return `~${estMin}:00`;
    }
  };

  const loadFileDuration = async (file: DropboxFile) => {
    if (file.duration) return;
    setLoadingDurations(prev => new Set(prev).add(file.path_lower));
    const duration = await getTempLinkAndDuration(file);
    setFiles(prev => prev.map(f => f.path_lower === file.path_lower ? { ...f, duration } : f));
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

      const sortedFolders = sortItems(folderItems);
      const sortedFiles = sortItems(musicFiles);

      setFolders(sortedFolders);
      setFiles(sortedFiles);
      setCurrentPath(path);
      setSelectedFiles(new Set());

      // kick off durations
      sortedFiles.forEach(loadFileDuration);
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
        setFiles([]);
        setFolders([]);
        setCurrentPath("");
        setSelectedFiles(new Set());
        setFolderHistory([]);
        return;
      }
      toast({
        title: "Error",
        description: error?.message || "Failed to load folders from Dropbox.",
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

  const isAllSelected = files.length > 0 && selectedFiles.size === files.length;
  const isIndeterminate = selectedFiles.size > 0 && selectedFiles.size < files.length;

  /** Call the unified server endpoint for non-transcode inputs (mp3/aac/etc) */
  const serverProcessAudio = async (audioUrl: string, fileName: string) => {
    const quality =
      (localStorage.getItem('conversionQuality') === 'aac-320') ? 'high' : 'standard';
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
    return res.json(); // { ok, url, storage_type:'r2', storage_bucket, storage_key, content_type, originalFilename, transcoded, quality }
  };

  const retryFailedImport = async (filePath: string) => {
    const file = files.find(f => f.path_lower === filePath);
    if (!file) return;
    setImportProgress(prev => ({
      ...prev,
      [filePath]: { ...prev[filePath], status: 'pending', error: undefined }
    }));
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

    updateProgress('processing', undefined, 10);

    const createTrack = async (payload: any) => {
      // basic retry
      let lastErr: Error | null = null;
      for (let a = 1; a <= 3; a++) {
        try {
          await addTrackMutation.mutateAsync(payload);
          return;
        } catch (e: any) {
          lastErr = e instanceof Error ? e : new Error(String(e));
          if (a < 3) await new Promise(r => setTimeout(r, 500 * Math.pow(2, a - 1)));
        }
      }
      throw lastErr || new Error("addTrack failed");
    };

    try {
      const needsTranscoding = importTranscodingService.needsTranscoding(file.name);
      const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);

      // Extract any tags we can before transform
      const metadata = await audioMetadataService.getBestMetadata(tempUrl, file.name);
      const desiredTitleFromName = file.name.replace(/\.[^/.]+$/, "");

      let result: any;
      if (needsTranscoding) {
        updateProgress('processing', undefined, 35);
        const conv = localStorage.getItem('conversionQuality') || 'mp3-320';
        const outFmt = conv === 'aac-320' ? 'aac' : 'mp3';
        result = await importTranscodingService.transcodeAndStore(tempUrl, file.name, outFmt);
      } else {
        updateProgress('processing', undefined, 35);
        result = await serverProcessAudio(tempUrl, file.name);
      }

      updateProgress('processing', undefined, 65);

      // Determine duration from the stored file's playback URL
      const seconds = await getDurationFromUrl(result.url);
      const duration = formatDuration(seconds);

      const title =
        (result.originalFilename?.replace(/\.[^/.]+$/, "") || "").trim() ||
        (metadata.title || "").trim() ||
        desiredTitleFromName ||
        "Unknown Track";

      const artist = (metadata.artist || "Unknown Artist").trim();

      // Create the DB row using R2-first fields; do not persist a presigned URL
      const trackData = {
        title,
        artist,
        duration,
        // R2 storage fields:
        storage_type: 'r2',
        storage_key: result.storage_key,
        // optional extras if your insert supports them:
        storage_url: null,
        fileUrl: null,
        dropbox_path: null,
        is_public: false,
      };

      updateProgress('processing', undefined, 85);
      await createTrack(trackData);

      updateProgress('success', undefined, 100);
      return true;
    } catch (err: any) {
      updateProgress('error', err?.message || 'Unknown error');
      return false;
    }
  };

  // Connection helpers
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

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const onMsg = (event: MessageEvent) => {
        if (event.data?.type === 'DROPBOX_AUTH_SUCCESS') {
          window.removeEventListener('message', onMsg);
          setIsConnecting(false);
          setTimeout(() => {
            checkConnection().then(ok => {
              if (ok) {
                setIsConnected(true);
                loadFolders();
              }
            });
          }, 800);
        } else if (event.data?.type === 'DROPBOX_AUTH_ERROR') {
          window.removeEventListener('message', onMsg);
          setIsConnecting(false);
        }
      };
      window.addEventListener('message', onMsg);
      await dropboxService.authenticate();
    } catch (error) {
      setIsConnecting(false);
      toast({
        title: "Connection failed",
        description: "Failed to connect to Dropbox. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      localStorage.removeItem('dropbox_access_token');
      setIsConnected(false);
      setFolders([]);
      setFiles([]);
      setSelectedFiles(new Set());
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

    // Seed progress + pending list
    const chosen = files.filter(f => selectedFiles.has(f.path_lower));
    const initial: ImportProgress = {};
    chosen.forEach(f => { initial[f.path_lower] = { path: f.path_lower, name: f.name, status: 'pending' }; });
    setImportProgress(initial);

    onPendingTracksChange?.(
      chosen.map(f => ({
        id: `pending-${f.path_lower}`,
        title: f.name,
        artist: 'Processing...',
        duration: f.duration || '--:--',
        status: 'processing' as const,
        progress: 0
      }))
    );

    let ok = 0;
    for (let i = 0; i < chosen.length; i++) {
      const success = await processFile(chosen[i], i + 1, chosen.length);
      if (success) ok++;
      toast({
        title: `Import Progress: ${i + 1}/${chosen.length}`,
        description: `Completed: ${ok}, Failed: ${i + 1 - ok}`,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["tracks"] });

    const failed = chosen.length - ok;
    toast({
      title: "Import Complete",
      description: failed > 0
        ? `Imported ${ok}/${chosen.length}. ${failed} failed — see status list.`
        : `Imported all ${ok} file${ok === 1 ? '' : 's'} to your library.`,
      variant: failed > 0 ? "destructive" : "default",
    });

    setIsSyncing(false);
  };

  // Load root when expanded
  useEffect(() => {
    if (isExpanded) {
      checkConnection().then(connected => {
        if (connected && files.length === 0 && folders.length === 0 && !isLoading) {
          loadFolders();
        }
      });
    }
  }, [isExpanded]);

  // Refresh after auth refresh
  useEffect(() => {
    const handleAuthRefresh = () => {
      setTimeout(() => {
        if (isExpanded) loadFolders(currentPath);
      }, 500);
    };
    window.addEventListener('dropboxAuthRefreshed', handleAuthRefresh);
    return () => window.removeEventListener('dropboxAuthRefreshed', handleAuthRefresh);
  }, [isExpanded, currentPath]);

  // Resort on order change
  useEffect(() => {
    if (files.length > 0 || folders.length > 0) {
      setFiles(prev => sortItems(prev));
      setFolders(prev => sortItems(prev));
    }
  }, [sortOrder]);

  // Convert progress -> pending tracks for outer list
  useEffect(() => {
    const pending = Object.values(importProgress)
      .filter(p => p.status === 'pending' || p.status === 'processing' || p.status === 'error')
      .map(p => ({
        id: `pending-${p.path}`,
        title: p.name.replace(/\.[^/.]+$/, '') || 'Unknown Track',
        artist: p.status === 'pending' ? 'Queued...' :
                p.status === 'processing' ? 'Processing...' : 'Unknown Artist',
        duration: '--:--',
        status: p.status === 'error' ? 'failed' as const : 'processing' as const,
        error: p.error,
        progress: p.progress || 0
      }));
    onPendingTracksChange?.(pending);
  }, [importProgress, onPendingTracksChange]);

  const accordionValue = isExpanded ? "dropbox-sync" : "";

  return (
    <Accordion 
      type="single" 
      value={accordionValue}
      onValueChange={(v) => onExpandedChange?.(v === "dropbox-sync")}
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
              <div className="text-sm text-muted-foreground">Browse and sync music from your Dropbox</div>
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Connection row */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
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
                <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting} className="flex items-center gap-2">
                  {isConnecting ? (<><RefreshCw className="h-4 w-4 animate-spin" />Connecting...</>) : ('Connect to Dropbox')}
                </Button>
              )}
            </div>

            {/* Sorting */}
            {isConnected && !isLoading && (folders.length > 0 || files.length > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort all items:</span>
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

            {/* Path / nav */}
            {isConnected && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Folder className="w-4 h-4" />
                <span>{currentPath || "/"}</span>
                {folderHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={navigateBack} className="ml-auto">
                    Back
                  </Button>
                )}
              </div>
            )}

            {/* Loading */}
            {isConnected && isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading folders...
              </div>
            )}

            {!isConnected && (
              <div className="flex items-center justify-center py-8 text-center">
                <div>
                  <Unlink className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Connect to Dropbox to browse your music files</p>
                </div>
              </div>
            )}

            {/* Folders */}
            {isConnected && !isLoading && folders.length > 0 && (
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
            {isConnected && !isLoading && files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">Music Files</h4>
                  <Badge variant="secondary">{files.length} files</Badge>
                </div>

                {/* Select All */}
                <div className="flex items-center gap-2 p-2 border-b border-border">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                    style={{ backgroundColor: isIndeterminate ? 'hsl(var(--primary))' : undefined }}
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
                                  {progress.status}{progress.progress && ` (${progress.progress}%)`}
                                </span>
                                {progress.status === 'error' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); retryFailedImport(file.path_lower); }}
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
                          {progress?.status === 'processing' || loadingDurations.has(file.path_lower)
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : (file.duration || "--:--")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Import summary + button */}
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
                            const failed = Object.values(importProgress).filter(f => f.status === 'error');
                            Promise.all(failed.map(f => retryFailedImport(f.path)));
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
                  <div className="flex justify-center items-center gap-2 pt-2 border-top">
                    <Button onClick={syncSelectedFiles} disabled={isSyncing} size="sm" className="max-w-[343px]">
                      {isSyncing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>) : ('Import selected')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {isConnected && !isLoading && files.length === 0 && folders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No music files found in this folder</p>
              </div>
            )}

            {/* Refresh */}
            {isConnected && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadFolders(currentPath)}
                  disabled={isLoading}
                  className="max-w-[343px]"
                >
                  <RefreshCw className="w-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
