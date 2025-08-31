// src/components/DropboxSync.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Cloud,
  Download,
  RefreshCw,
  AlertCircle,
  Folder,
  ChevronRight,
  ArrowLeft,
  Shield,
  ExternalLink,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
} from "lucide-react";
import DropboxIcon from "@/components/icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { UnsupportedFilesModal } from "./UnsupportedFilesModal";

// ---- Backend API base for process-audio/track-url ----
const RAW_API_BASE =
  (import.meta as any)?.env?.VITE_APP_API_BASE ||
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";
const API_BASE = RAW_API_BASE.replace(/\/+$/, ""); // strip trailing slash

interface DropboxFile {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  ".tag": "file" | "folder";
}

// ---------- helpers: auth + metadata parsing ----------
async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Parse "Artist - Title.ext" into { artist, title }.
// Only split on the *first* " - " and keep the remainder as the title.
// If no separator present, treat the whole thing as title.
function parseArtistTitleFromFilename(fileName: string): { artist: string; title: string } {
  const base = fileName.replace(/\.[^/.]+$/, "");
  const parts = base.split(/\s*-\s*/);
  const artistCandidate = parts[0]?.trim() || "";
  const titleCandidate = parts.length > 1 ? parts.slice(1).join(" - ").trim() : "";

  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

  if (artistCandidate && titleCandidate) {
    return { artist: collapse(artistCandidate), title: collapse(titleCandidate) };
  }
  // Fallback when no delimiter: unknown artist, full base name as title
  return { artist: "Unknown Artist", title: collapse(base) };
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
  const [sortBy, setSortBy] = useState<"name" | "modified">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, DropboxFile[]>>(new Map());
  const [globalFileSelection, setGlobalFileSelection] = useState<Map<string, DropboxFile>>(
    new Map()
  );
  const [showUnsupportedModal, setShowUnsupportedModal] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<string[]>([]);
  const [supportedImportCount, setSupportedImportCount] = useState(0);
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();
  const queryClient = useQueryClient();

  const shouldShowPrivacyWarning =
    connectionError.includes("blocked") || connectionError.includes("privacy");

  useEffect(() => {
    setCurrentRedirectUri(`${window.location.origin}/dropbox-callback`);
  }, []);

  useEffect(() => {
    const checkAuthStatus = () => {
      const authStatus = dropboxService.isAuthenticated();
      if (authStatus !== isConnected) {
        setIsConnected(authStatus);
        setConnectionError("");
        if (authStatus) {
          toast({
            title: "Connected to Dropbox",
            description: "You can now sync your music files.",
          });
        }
      }
      const authSuccess = localStorage.getItem("dropbox_auth_success");
      if (authSuccess === "true") {
        localStorage.removeItem("dropbox_auth_success");
        setIsConnected(true);
        setConnectionError("");
      }
    };

    checkAuthStatus();
    const interval = setInterval(checkAuthStatus, 2000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "DROPBOX_AUTH_SUCCESS") {
        if (event.data.token) {
          localStorage.setItem("dropbox_access_token", event.data.token);
        }
        setTimeout(checkAuthStatus, 500);
        setIsConnecting(false);
      } else if (event.data?.type === "DROPBOX_AUTH_ERROR") {
        setConnectionError(event.data.error || "Authentication failed");
        setIsConnecting(false);
        setShowBraveHelp(true);
      }
    };

    const handleFocus = () => {
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

    window.addEventListener("message", handleMessage);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [toast, isConnected, isConnecting]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setConnectionError("");
      setShowBraveHelp(false);
      await dropboxService.authenticate();

      setTimeout(() => {
        if (isConnecting && !dropboxService.isAuthenticated()) {
          setConnectionError("Connection taking longer than expected");
          setShowBraveHelp(true);
          setIsConnecting(false);
        }
      }, 10000);
    } catch (error: any) {
      console.error("Authentication error:", error);
      setConnectionError(error?.message || "Failed to initiate Dropbox authentication");
      setIsConnecting(false);

      if (error?.message?.includes("popup") || error?.message?.includes("blocked")) {
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
      localStorage.setItem("dropbox_access_token", manualToken.trim());
      setIsConnected(true);
      setManualToken("");
      setShowBraveHelp(false);
      setConnectionError("");

      toast({
        title: "Connected to Dropbox",
        description: "Successfully connected using manual token.",
      });
    } catch {
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
      const accountData = await dropboxService.getAccountInfo();
      setAccountInfo(accountData);
      await dropboxService.checkAppPermissions();
    } catch (error) {
      console.error("Failed to load account info:", error);
    }
  };

  const loadFolders = async (path: string = "") => {
    if (!isConnected) return;

    setIsLoading(true);
    setDebugInfo("");
    setPermissionIssue(false);

    try {
      const allItems = await dropboxService.listFiles(path);

      const debugDetails = [
        `=== ENHANCED DEBUGGING ===`,
        `Total items returned: ${allItems.length}`,
        `Path queried: "${path}"`,
        `API call successful: YES`,
        ``,
        `Items breakdown:`,
      ];

      if (allItems.length === 0) {
        debugDetails.push(`  No items found - see notes about permissions or empty folder.`);
        if (!path) setPermissionIssue(true);
      } else {
        allItems.forEach((item: any, index: number) => {
          debugDetails.push(
            `  ${index + 1}. ${item.name} (${item[".tag"]}) - Path: ${item.path_lower}`
          );
        });
      }

      setDebugInfo(debugDetails.join("\n"));

      const folderItems = allItems.filter((i: any) => i[".tag"] === "folder");
      const musicFiles = allItems.filter((i: any) => {
        if (i[".tag"] !== "file") return false;
        const n = i.name.toLowerCase();
        const supported = [
          ".mp3",
          ".wav",
          ".m4a",
          ".flac",
          ".aac",
          ".ogg",
          ".wma",
          ".aif",
          ".aiff",
        ];
        return supported.some((ext) => n.endsWith(ext));
      });

      const sortedFolders = sortItems(folderItems);
      const sortedFiles = sortItems(musicFiles);

      setFolders(sortedFolders);
      setFiles(sortedFiles);
      setCurrentPath(path);
      setSelectedFiles(new Set());

      if (!path && allItems.length === 0) {
        setPermissionIssue(true);
        toast({
          title: "No items found",
          description:
            "Your Dropbox appears empty or the app has limited access. Check the debug panel below.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("=== ERROR LOADING FOLDERS ===", error);
      setDebugInfo(
        `Error: ${error?.message}\nPath: "${path}"\nThis might be a permission or authentication issue.`
      );
      toast({
        title: "Error",
        description: error?.message || "Failed to load folders from Dropbox.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sortItems = (items: DropboxFile[]) => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") comparison = a.name.localeCompare(b.name);
      else if (sortBy === "modified")
        comparison =
          new Date(a.server_modified).getTime() - new Date(b.server_modified).getTime();
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setViewMode("file-view");
    setFolderHistory([...folderHistory, currentPath]);
    loadFolders(folderPath);
  };

  const handleBackToFolderSelect = () => {
    setViewMode("folder-select");
    setSelectedFolder("");
    setCurrentPath("");
    setFiles([]);
    setFolders([]);
    setFolderHistory([]);
    setSelectedFiles(new Set());
  };

  const navigateToFolder = (folderPath: string) => {
    setFolderHistory([...folderHistory, currentPath]);
    loadFolders(folderPath);
  };

  const handleFileToggle = (filePath: string) => {
    const next = new Set(selectedFiles);
    if (next.has(filePath)) next.delete(filePath);
    else next.add(filePath);
    setSelectedFiles(next);
  };

  const handleGlobalFileToggle = (file: DropboxFile) => {
    const next = new Map(globalFileSelection);
    if (next.has(file.path_lower)) next.delete(file.path_lower);
    else next.set(file.path_lower, file);
    setGlobalFileSelection(next);
  };

  const loadFolderContents = async (folderPath: string) => {
    try {
      const allItems = await dropboxService.listFiles(folderPath);
      const musicFiles = allItems.filter((i: any) => {
        if (i[".tag"] !== "file") return false;
        const n = i.name.toLowerCase();
        const supported = [
          ".mp3",
          ".wav",
          ".m4a",
          ".flac",
          ".aac",
          ".ogg",
          ".wma",
          ".aif",
          ".aiff",
        ];
        return supported.some((ext) => n.endsWith(ext));
      });

      const sortedFiles = sortItems(musicFiles);
      setFolderContents((prev) => {
        const m = new Map(prev);
        m.set(folderPath, sortedFiles);
        return m;
      });
    } catch (error) {
      console.error("Failed to load folder contents:", error);
      toast({
        title: "Error",
        description: `Failed to load contents of folder: ${folderPath}`,
        variant: "destructive",
      });
    }
  };

  const toggleFolderExpansion = async (folderPath: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folderPath)) {
      next.delete(folderPath);
    } else {
      next.add(folderPath);
      if (!folderContents.has(folderPath)) {
        await loadFolderContents(folderPath);
      }
    }
    setExpandedFolders(next);
  };

  const handleFolderClick = async (folderPath: string) => {
    if (viewMode === "folder-select") {
      await toggleFolderExpansion(folderPath);
    } else {
      await loadFolders(folderPath);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
  };

  const handleSelectAll = () => {
    if (viewMode === "folder-select") {
      if (globalFileSelection.size === 0) {
        const next = new Map<string, DropboxFile>();
        expandedFolders.forEach((folderPath) => {
          (folderContents.get(folderPath) || []).forEach((f) => next.set(f.path_lower, f));
        });
        setGlobalFileSelection(next);
      } else {
        setGlobalFileSelection(new Map());
      }
    } else {
      if (selectedFiles.size === files.length) {
        setSelectedFiles(new Set());
      } else {
        setSelectedFiles(new Set(files.map((f) => f.path_lower)));
      }
    }
  };

  // --- helpers: duration from URL ---
  const getDurationFromUrl = async (fileUrl: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => resolve(audio.duration || 0));
      audio.addEventListener("error", () => resolve(0));
      audio.preload = "metadata";
      audio.src = fileUrl;
    });
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ---- Unified import path via backend /api/process-audio ----
  const processDropboxFileToR2 = async (file: DropboxFile) => {
    // Always obtain a temporary link (public URL) for backend to fetch
    const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);

    // Quality: backend only uses this for raw/wave formats; MP3/M4A/AAC should pass-through.
    const conversionQuality = localStorage.getItem("conversionQuality") || "mp3-320";
    const quality = conversionQuality === "aac-320" ? "high" : "standard";

    // Include Supabase bearer token so the function can enforce access rules
    const authHeader = await getAuthHeader();

    const resp = await fetch(`${API_BASE}/api/process-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      credentials: "include",
      body: JSON.stringify({
        audioUrl: tempUrl,
        fileName: file.name,
        quality, // 'standard' or 'high'
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`process-audio failed (${resp.status}): ${t}`);
    }

    const data = await resp.json();
    // Expected: { ok, url, storage_type:'r2', storage_bucket, storage_key, content_type, originalFilename, transcoded, quality }
    if (!data?.ok || !data?.storage_key) {
      throw new Error("process-audio response missing storage_key");
    }

    return data as {
      ok: true;
      url: string;
      storage_type: "r2";
      storage_bucket: string;
      storage_key: string;
      content_type: string;
      originalFilename?: string;
      transcoded?: boolean;
      quality?: "standard" | "high";
    };
  };

  const syncFiles = async () => {
    if (!isConnected) return;

    let filesToSync: DropboxFile[] = [];
    if (viewMode === "folder-select") {
      filesToSync = Array.from(globalFileSelection.values());
    } else {
      filesToSync =
        selectedFiles.size > 0 ? files.filter((f) => selectedFiles.has(f.path_lower)) : files;
    }
    if (filesToSync.length === 0) return;

    // Filter supported file extensions
    const supported = [
      ".mp3",
      ".wav",
      ".m4a",
      ".flac",
      ".aac",
      ".ogg",
      ".wma",
      ".aif",
      ".aiff",
    ];
    const supportedFiles = filesToSync.filter((f) =>
      supported.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (supportedFiles.length === 0) return;

    setIsSyncing(true);

    try {
      // Process each file -> R2 (transcode if needed) -> compute duration -> insert track with R2 metadata
      for (const file of supportedFiles) {
        try {
          const result = await processDropboxFileToR2(file);

          // duration from returned URL
          let durationStr = "--:--";
          try {
            const secs = await getDurationFromUrl(result.url);
            durationStr = formatDuration(secs);
          } catch {
            /* noop */
          }

          // Derive title/artist from filename "Artist - Title"
          const { artist, title } = parseArtistTitleFromFilename(
            result.originalFilename || file.name
          );

          // Folder path (for source_folder)
          const sourceFolder = file.path_lower.split("/").slice(0, -1).join("/");

          // Insert new track row with R2 metadata (no legacy fileUrl!)
          await addTrackMutation.mutateAsync({
            title,
            artist,
            duration: durationStr,
            storage_type: "r2",
            storage_key: result.storage_key,
            // DO NOT store presigned URL in file_url/storage_url; resolve at playback.
            dropbox_path: file.path_lower,
            source_folder: sourceFolder,
            // If tracks table lacks defaults, you can uncomment:
            // is_public: false,
            // play_count: 0,
          } as any);

          // Optional: immediate refresh
          queryClient.invalidateQueries({ queryKey: ["tracks"] });
        } catch (oneError: any) {
          console.error("Failed to import:", file.name, oneError);
          toast({
            title: "Import failed",
            description: `${file.name}: ${oneError?.message || "Unknown error"}`,
            variant: "destructive",
          });
        }
      }

      // Clear selections
      setSelectedFiles(new Set());
      setGlobalFileSelection(new Map());

      toast({
        title: "Import complete",
        description: `Imported ${supportedFiles.length} file${
          supportedFiles.length === 1 ? "" : "s"
        } to R2.`,
      });
    } catch (error) {
      console.error("Sync failed:", error);
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
    setFolders([]);
    setSelectedFolder("");
    setCurrentPath("");
    setViewMode("folder-select");
    setConnectionError("");
    setShowBraveHelp(false);
    setDebugInfo("");
    setAccountInfo(null);
    setFolderHistory([]);
    setSelectedFiles(new Set());
    setExpandedFolders(new Set());
    setFolderContents(new Map());
    setGlobalFileSelection(new Map());
    toast({ title: "Disconnected", description: "Disconnected from Dropbox." });
  };

  useEffect(() => {
    if (isConnected && viewMode === "folder-select") {
      setTimeout(() => {
        loadFolders("");
        loadAccountInfo();
      }, 1000);
    }
  }, [isConnected, viewMode]);

  useEffect(() => {
    if (folders.length > 0) setFolders((prev) => sortItems([...prev]));
    if (files.length > 0) setFiles((prev) => sortItems([...prev]));
  }, [sortBy, sortOrder]);

  if (!isConnected) {
    return (
      <Card className="p-6 text-center">
        <div className="w-20 h-20 border-2 border-primary rounded-lg flex items-center justify-center mx-auto mb-4">
          <DropboxIcon className="text-primary" size={48} />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-primary">Connect to Dropbox</h3>
        <p className="text-muted-foreground mb-4">
          Sync your music library with a specific Dropbox folder to automatically import tracks.
        </p>

        {connectionError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{connectionError}</span>
            </div>
            {connectionError.includes("redirect_uri") && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>
                  Current redirect URI:{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">{currentRedirectUri}</code>
                </p>
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
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full max-w-[343px]">
            <DropboxIcon className="mr-2" size={16} />
            {isConnecting ? "Connecting..." : "Connect Dropbox"}
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
                  <span className="text-blue-800">
                    Check that your Dropbox app redirect URI matches:{" "}
                    <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">{currentRedirectUri}</code>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-900">2.</span>
                  <span className="text-blue-800">
                    Disable browser shields/privacy protection for this site and try again
                  </span>
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
                          <DialogDescription>Follow these steps to connect manually:</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="text-sm space-y-2">
                            <p>
                              <strong>Step 1:</strong>{" "}
                              <a
                                href="https://www.dropbox.com/developers/apps"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                              >
                                Dropbox App Console
                              </a>
                            </p>
                            <p>
                              <strong>Step 2:</strong> Create a new app or use existing one
                            </p>
                            <p>
                              <strong>Step 3:</strong> Generate an access token
                            </p>
                            <p>
                              <strong>Step 4:</strong> Paste the token below:
                            </p>
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
          <DropboxIcon className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-primary">Dropbox Sync</h3>
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
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </div>

      {(folders.length > 0 || files.length > 0) && (
        <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label className="text-sm">Sort by:</Label>
              <Select value={sortBy} onValueChange={(v: "name" | "modified") => setSortBy(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="modified">Modified</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={toggleSortOrder}>
                {sortOrder === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          {viewMode === "file-view" && files.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                <Check className="w-4 h-4 mr-2" />
                {selectedFiles.size === files.length ? "Deselect All" : "Select All"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedFiles.size > 0 ? `${selectedFiles.size} selected` : "None selected"}
              </span>
            </div>
          )}
          {viewMode === "folder-select" && globalFileSelection.size > 0 && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                <Check className="w-4 h-4 mr-2" />
                Clear All Selections
              </Button>
              <span className="text-sm text-muted-foreground">
                {globalFileSelection.size} file{globalFileSelection.size === 1 ? "" : "s"} selected
              </span>
            </div>
          )}
        </div>
      )}

      {viewMode === "folder-select" && globalFileSelection.size > 0 && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {globalFileSelection.size} file{globalFileSelection.size === 1 ? "" : "s"} selected for sync
              </p>
              <p className="text-xs text-muted-foreground">
                Files selected from{" "}
                {
                  new Set(
                    Array.from(globalFileSelection.values()).map((f) =>
                      f.path_lower.split("/").slice(0, -1).join("/")
                    )
                  ).size
                }{" "}
                folder
                {
                  new Set(
                    Array.from(globalFileSelection.values()).map((f) =>
                      f.path_lower.split("/").slice(0, -1).join("/")
                    )
                  ).size === 1
                    ? ""
                    : "s"
                }
              </p>
            </div>
            <Button onClick={syncFiles} disabled={isSyncing || addTrackMutation.isPending}>
              <Download className="w-4 h-4 mr-2" />
              {isSyncing
                ? "Syncing..."
                : `Sync ${globalFileSelection.size} File${globalFileSelection.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {accountInfo && showDetailedDebug && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium mb-2 text-primary">Account Information:</h4>
          <div className="text-xs text-blue-800 space-y-1">
            <p>
              <strong>Name:</strong> {accountInfo.name?.display_name || "Unknown"}
            </p>
            <p>
              <strong>Email:</strong> {accountInfo.email || "Unknown"}
            </p>
            <p>
              <strong>Account ID:</strong> {accountInfo.account_id || "Unknown"}
            </p>
            <p>
              <strong>Account Type:</strong> {accountInfo.account_type?.[".tag"] || "Unknown"}
            </p>
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
              <li>There are scope issues in the app configuration</li>
            </ol>
            <p className="mt-2">
              <strong>Try:</strong>
            </p>
            <ul className="list-disc list-inside ml-2">
              <li>Ensure the app is set to “Full Dropbox” access</li>
              <li>Disconnect and reconnect, granting full access</li>
              <li>Verify there are files in the root or chosen folder</li>
            </ul>
          </div>
        </div>
      )}

      <div className="min-h-[300px] max-h-[600px] resize-y overflow-hidden border rounded-lg">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Loading from Dropbox...</p>
            </div>
          ) : viewMode === "folder-select" ? (
            <div className="p-2">
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-primary">Choose a folder to sync:</h4>
                {currentPath && (
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <span>Current path: /{currentPath.replace(/^\//, "")}</span>
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
                      <li>You're in "App folder" mode instead of full access</li>
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentPath && (
                    <div
                      className="flex items-center justify-between p-3 rounded border cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        const parentPath = currentPath.split("/").slice(0, -1).join("/");
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
                    <div key={folder.path_lower} className="border rounded-lg">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFolderExpansion(folder.path_lower)}
                            className="h-auto p-1"
                          >
                            {expandedFolders.has(folder.path_lower) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                          <Folder className="w-4 h-4" />
                          <span
                            className="font-medium text-sm cursor-pointer hover:text-primary"
                            onClick={() => handleFolderSelect(folder.path_lower)}
                          >
                            {folder.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => navigateToFolder(folder.path_lower)}>
                            Browse
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!folderContents.has(folder.path_lower)) {
                                await loadFolderContents(folder.path_lower);
                              }
                              const files = folderContents.get(folder.path_lower) || [];
                              if (files.length > 0) {
                                const fileSelection = new Map<string, DropboxFile>();
                                files.forEach((f) => fileSelection.set(f.path_lower, f));
                                setGlobalFileSelection(fileSelection);
                                await syncFiles();
                              } else {
                                toast({
                                  title: "No Files",
                                  description: "No audio files found in this folder.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Import All
                          </Button>
                        </div>
                      </div>

                      {expandedFolders.has(folder.path_lower) && (
                        <div className="border-t border-border px-3 pb-3">
                          {folderContents.get(folder.path_lower)?.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No audio files found</p>
                          ) : (
                            <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                              {folderContents.get(folder.path_lower)?.map((file) => (
                                <div
                                  key={file.path_lower}
                                  className="flex items-center justify-between p-2 rounded hover:bg-muted/30"
                                >
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={globalFileSelection.has(file.path_lower)}
                                      onCheckedChange={() => handleGlobalFileToggle(file)}
                                    />
                                    <div>
                                      <p className="font-medium text-xs">{file.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024 / 1024).toFixed(1)} MB
                                      </p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {new Date(file.server_modified).toLocaleDateString()}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2">
              {files.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No music files found in this folder</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Make sure you have audio files (.mp3, .wav, .m4a, .aif, .aiff, .flac, .aac, .ogg, .wma) in the
                    selected folder
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Found {files.length} music file{files.length !== 1 ? "s" : ""} in selected folder
                        {selectedFiles.size > 0 && ` (${selectedFiles.size} selected)`}
                      </p>
                      {files.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectedFiles.size === files.length}
                            onCheckedChange={() => {
                              if (selectedFiles.size === files.length) {
                                setSelectedFiles(new Set());
                              } else {
                                setSelectedFiles(new Set(files.map((f) => f.path_lower)));
                              }
                            }}
                          />
                          <label className="text-sm">Select All</label>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={syncFiles}
                      disabled={isSyncing || addTrackMutation.isPending || (selectedFiles.size === 0 && files.length > 0)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isSyncing
                        ? "Syncing..."
                        : `Sync ${selectedFiles.size > 0 ? selectedFiles.size : files.length} File${
                            selectedFiles.size === 1 || files.length === 1 ? "" : "s"
                          }`}
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {files.map((file) => (
                      <div key={file.path_lower} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={selectedFiles.has(file.path_lower)}
                            onCheckedChange={() => handleFileToggle(file.path_lower)}
                          />
                          <div>
                            <p className="font-medium text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
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
        </div>

        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize opacity-50 hover:opacity-100 transition-opacity">
          <div className="w-full h-full bg-muted-foreground/20 rounded-tl-lg"></div>
        </div>
      </div>

      <UnsupportedFilesModal
        isOpen={showUnsupportedModal}
        onClose={() => setShowUnsupportedModal(false)}
        unsupportedFiles={unsupportedFiles}
        supportedCount={supportedImportCount}
      />
    </Card>
  );
};

export default DropboxSync;
