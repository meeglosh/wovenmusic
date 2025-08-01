
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Download, RefreshCw, AlertCircle, Folder, ChevronRight, ArrowLeft, Shield, ExternalLink, Info, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronDown } from "lucide-react";
import DropboxIcon from "@/components/icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";
import { importTranscodingService } from "@/services/importTranscodingService";
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { UnsupportedFilesModal } from "./UnsupportedFilesModal";

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
  const [sortBy, setSortBy] = useState<'name' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, DropboxFile[]>>(new Map());
  const [globalFileSelection, setGlobalFileSelection] = useState<Map<string, DropboxFile>>(new Map());
  const [showUnsupportedModal, setShowUnsupportedModal] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<string[]>([]);
  const [supportedImportCount, setSupportedImportCount] = useState(0);
  const { toast } = useToast();
  const addTrackMutation = useAddTrack();
  const queryClient = useQueryClient();

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
      const musicFiles = allItems.filter(item => {
        if (item[".tag"] !== "file") return false;
        
        const fileName = item.name.toLowerCase();
        // Include .aif/.aiff files now that transcoding is supported
        const supportedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma', '.aif', '.aiff'];
        return supportedExtensions.some(ext => fileName.endsWith(ext));
      });
       
       // Sort folders and files
       const sortedFolders = sortItems(folderItems);
       const sortedFiles = sortItems(musicFiles);
       
       console.log('Filtered and sorted results:');
       console.log('- Folders:', sortedFolders.length, sortedFolders);
       console.log('- Music files:', sortedFiles.length, sortedFiles);
       
       setFolders(sortedFolders);
       setFiles(sortedFiles);
       setCurrentPath(path);
       setSelectedFiles(new Set()); // Clear selection when loading new folder
      
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

  const sortItems = (items: DropboxFile[]) => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'modified') {
        comparison = new Date(a.server_modified).getTime() - new Date(b.server_modified).getTime();
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setViewMode("file-view");
    setFolderHistory([...folderHistory, currentPath]);
    // Don't change browsing mode - keep whatever the user had selected
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
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const handleGlobalFileToggle = (file: DropboxFile) => {
    const newSelection = new Map(globalFileSelection);
    if (newSelection.has(file.path_lower)) {
      newSelection.delete(file.path_lower);
    } else {
      newSelection.set(file.path_lower, file);
    }
    setGlobalFileSelection(newSelection);
  };

  const loadFolderContents = async (folderPath: string) => {
    console.log('=== LOADING FOLDER CONTENTS ===');
    console.log('Folder path:', folderPath);
    
    try {
      const allItems = await dropboxService.listFiles(folderPath);
      console.log('Raw items from folder:', allItems);
      
      const musicFiles = allItems.filter(item => {
        if (item[".tag"] !== "file") return false;
        
        const fileName = item.name.toLowerCase();
        // Include .aif/.aiff files now that transcoding is supported
        const supportedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma', '.aif', '.aiff'];
        const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext));
        
        console.log(`File: ${item.name}, isFile: ${item[".tag"] === "file"}, isSupported: ${isSupported}`);
        return isSupported;
      });
      
      console.log('Filtered music files:', musicFiles);
      const sortedFiles = sortItems(musicFiles);
      console.log('Sorted music files:', sortedFiles);
      
      setFolderContents(prev => {
        const newMap = new Map(prev);
        newMap.set(folderPath, sortedFiles);
        console.log('Updated folder contents map:', newMap);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to load folder contents:', error);
      toast({
        title: "Error",
        description: `Failed to load contents of folder: ${folderPath}`,
        variant: "destructive",
      });
    }
  };

  const toggleFolderExpansion = async (folderPath: string) => {
    console.log('=== TOGGLE FOLDER EXPANSION ===');
    console.log('Folder path:', folderPath);
    console.log('Currently expanded folders:', expandedFolders);
    
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      console.log('Collapsing folder');
      newExpanded.delete(folderPath);
    } else {
      console.log('Expanding folder');
      newExpanded.add(folderPath);
      // Load folder contents if not already loaded
      if (!folderContents.has(folderPath)) {
        console.log('Loading folder contents for first time');
        await loadFolderContents(folderPath);
      } else {
        console.log('Folder contents already loaded:', folderContents.get(folderPath));
      }
    }
    console.log('New expanded folders:', newExpanded);
    setExpandedFolders(newExpanded);
  };

  const handleFolderClick = async (folderPath: string) => {
    console.log('=== HANDLE FOLDER CLICK ===');
    console.log('Folder path:', folderPath);
    console.log('View mode:', viewMode);
    
    if (viewMode === "folder-select") {
      // In folder-select mode, expand/collapse to show contents
      await toggleFolderExpansion(folderPath);
    } else {
      // In file-view mode, navigate into the folder
      console.log('Navigating into folder (file-view mode)');
      await loadFolders(folderPath);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleSelectAll = () => {
    if (viewMode === "folder-select") {
      // In folder select mode, work with global file selection
      if (globalFileSelection.size === 0) {
        // Select all visible files from all expanded folders
        const newSelection = new Map<string, DropboxFile>();
        expandedFolders.forEach(folderPath => {
          const files = folderContents.get(folderPath) || [];
          files.forEach(file => newSelection.set(file.path_lower, file));
        });
        setGlobalFileSelection(newSelection);
      } else {
        setGlobalFileSelection(new Map());
      }
    } else {
      // In file view mode, work with current folder selection
      if (selectedFiles.size === files.length) {
        setSelectedFiles(new Set());
      } else {
        setSelectedFiles(new Set(files.map(f => f.path_lower)));
      }
    }
  };

  // Helper function to get duration from Dropbox file
  const getDurationFromDropboxFile = async (fileUrl: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      
      audio.addEventListener('error', () => {
        resolve(0); // Return 0 if we can't get duration
      });
      
      audio.crossOrigin = 'anonymous';
      audio.src = fileUrl;
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const syncFiles = async () => {
    if (!isConnected) return;
    
    let filesToSync: DropboxFile[] = [];
    
    if (viewMode === "folder-select") {
      // Sync globally selected files
      filesToSync = Array.from(globalFileSelection.values());
    } else {
      // Sync files from current folder
      filesToSync = selectedFiles.size > 0 
        ? files.filter(file => selectedFiles.has(file.path_lower))
        : files;
    }
    
    if (filesToSync.length === 0) return;
    
    // Separate supported and unsupported files
    const supportedFiles: DropboxFile[] = [];
    const unsupportedAifFiles: string[] = [];
    
    filesToSync.forEach(file => {
      const fileName = file.name.toLowerCase();
      // Now include .aif/.aiff files as supported since transcoding is available
      const supportedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma', '.aif', '.aiff'];
      if (supportedExtensions.some(ext => fileName.endsWith(ext))) {
        supportedFiles.push(file);
      }
    });
    
    // Show modal if there are unsupported .aif files
    if (unsupportedAifFiles.length > 0) {
      setUnsupportedFiles(unsupportedAifFiles);
      setSupportedImportCount(supportedFiles.length);
      setShowUnsupportedModal(true);
    }
    
    // If no supported files, just show modal and return
    if (supportedFiles.length === 0) {
      return;
    }
    
    setIsSyncing(true);
    
    
    try {
      // Phase 1: Add all supported tracks with duration extraction
      const trackPromises = supportedFiles.map(async (file) => {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        const [title, artist] = fileName.split(' - ');
        const dropboxPath = file.path_lower;
        
        console.log('Adding track with duration extraction:', dropboxPath);
        
        // For files that need transcoding, add with a placeholder status
        const needsTranscoding = importTranscodingService.needsTranscoding(file.path_lower);
        
        let fileUrl = dropboxPath;
        let duration = '--:--';
        
        // For files that don't need transcoding, get the temporary URL and extract duration
        if (!needsTranscoding) {
          try {
            fileUrl = await dropboxService.getTemporaryLink(file.path_lower);
            console.log('Got temporary URL for native file:', fileUrl);
            
            // Extract duration from the audio file
            const durationSeconds = await getDurationFromDropboxFile(fileUrl);
            duration = formatDuration(durationSeconds);
            console.log('Extracted duration:', duration, 'for file:', file.name);
          } catch (error) {
            console.warn('Failed to get temporary URL or extract duration:', error);
            fileUrl = dropboxPath;
          }
        }
        
        // Add track
        const track = await addTrackMutation.mutateAsync({
          title: title || fileName,
          artist: artist || 'Unknown Artist',
          duration: needsTranscoding ? 'Transcoding...' : duration,
          fileUrl: fileUrl,
          source_folder: file.path_lower.split('/').slice(0, -1).join('/'),
          dropbox_path: dropboxPath
        });
        
        return { track, file, fileName };
      });
      
      const addedTracks = await Promise.all(trackPromises);
      
      const transcodingCount = addedTracks.filter(({ file }) => 
        importTranscodingService.needsTranscoding(file.path_lower)
      ).length;
      
      toast({
        title: "Tracks Added",
        description: transcodingCount > 0 
          ? `Added ${supportedFiles.length} tracks. ${transcodingCount} files are being transcoded...`
          : `Added ${supportedFiles.length} tracks successfully.`,
      });
      
      // Phase 2: Process transcoding in background for files that need it
      const transcodingPromises = addedTracks.map(async ({ track, file, fileName }) => {
        if (!importTranscodingService.needsTranscoding(file.path_lower)) {
          return; // No transcoding needed
        }
        
        console.log('Background transcoding for:', file.name);
        
        try {
          // Update status to show transcoding is in progress
          await supabase
            .from('tracks')
            .update({ duration: 'Transcoding...' })
            .eq('id', track.id);
          
          // Invalidate queries to refresh UI immediately
          queryClient.invalidateQueries({ queryKey: ["tracks"] });
          
          // Get temporary link for the original file
          const tempUrl = await dropboxService.getTemporaryLink(file.path_lower);
          
          // Get conversion quality setting from localStorage
          const conversionQuality = localStorage.getItem('conversionQuality') || 'mp3-320';
          const outputFormat = conversionQuality === 'aac-320' ? 'aac' : 'mp3';
          
          // Transcode and store in Supabase Storage
          const transcodeResult = await importTranscodingService.transcodeAndStore(tempUrl, fileName, outputFormat);
          
          // Extract duration from transcoded file
          let finalDuration = '--:--';
          try {
            const durationSeconds = await getDurationFromDropboxFile(transcodeResult.publicUrl);
            finalDuration = formatDuration(durationSeconds);
            console.log('Extracted duration from transcoded file:', finalDuration);
          } catch (error) {
            console.warn('Failed to extract duration from transcoded file:', error);
          }
          
          // Use the original filename from transcoding service if available
          const displayName = transcodeResult.originalFilename?.replace(/\.[^/.]+$/, "") || 
                              file.name.replace(/\.[^/.]+$/, "");
          
          // Update the track with transcoded URL, extracted duration, and original filename
          const { error: updateError } = await supabase
            .from('tracks')
            .update({ 
              file_url: transcodeResult.publicUrl,
              duration: finalDuration,
              title: displayName
            })
            .eq('id', track.id);
            
          if (updateError) {
            console.error('Failed to update track with transcoded URL:', updateError);
            throw updateError;
          }
          
          console.log('Successfully updated track with transcoded URL:', transcodeResult.publicUrl);
          
          // Invalidate queries to show completion
          queryClient.invalidateQueries({ queryKey: ["tracks"] });
          
          toast({
            title: "Transcoding Complete",
            description: `${file.name} is now ready for playback.`,
          });
          
        } catch (transcodingError) {
          console.warn('Transcoding failed for file:', file.name, transcodingError);
          
          // Update the track to show transcoding failed
          await supabase
            .from('tracks')
            .update({ duration: 'Failed' })
            .eq('id', track.id);
          
          // Invalidate queries to show failure state
          queryClient.invalidateQueries({ queryKey: ["tracks"] });
          
          toast({
            title: "Transcoding Failed",
            description: `${file.name} will use original format. Playback may be limited.`,
            variant: "destructive",
          });
        }
      });
      
      // Don't wait for transcoding to complete - let it run in background
      Promise.all(transcodingPromises);
      
      // Clear selections immediately
      setSelectedFiles(new Set());
      setGlobalFileSelection(new Map());
      
    } catch (error) {
      console.error('Sync failed:', error);
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
    setFolderHistory([]);
    setSelectedFiles(new Set());
    setExpandedFolders(new Set());
    setFolderContents(new Map());
    setGlobalFileSelection(new Map());
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

  // Re-sort items when sort criteria changes
  useEffect(() => {
    if (folders.length > 0) {
      setFolders(prev => sortItems([...prev]));
    }
    if (files.length > 0) {
      setFiles(prev => sortItems([...prev]));
    }
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
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full max-w-[343px]">
            <DropboxIcon className="mr-2" size={16} />
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
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </div>

      {/* Sorting and View Controls */}
      {(folders.length > 0 || files.length > 0) && (
        <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label className="text-sm">Sort by:</Label>
              <Select value={sortBy} onValueChange={(value: 'name' | 'modified') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="modified">Modified</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={toggleSortOrder}>
                {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          {viewMode === "file-view" && files.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                <Check className="w-4 h-4 mr-2" />
                {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedFiles.size > 0 ? `${selectedFiles.size} selected` : 'None selected'}
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
                {globalFileSelection.size} file{globalFileSelection.size === 1 ? '' : 's'} selected
              </span>
            </div>
          )}
        </div>
      )}

      {/* Global Sync Button for folder browsing mode */}
      {viewMode === "folder-select" && globalFileSelection.size > 0 && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {globalFileSelection.size} file{globalFileSelection.size === 1 ? '' : 's'} selected for sync
              </p>
              <p className="text-xs text-muted-foreground">
                Files selected from {new Set(Array.from(globalFileSelection.values()).map(f => f.path_lower.split('/').slice(0, -1).join('/'))).size} folder{new Set(Array.from(globalFileSelection.values()).map(f => f.path_lower.split('/').slice(0, -1).join('/'))).size === 1 ? '' : 's'}
              </p>
            </div>
            <Button 
              onClick={syncFiles} 
              disabled={isSyncing || addTrackMutation.isPending}
            >
              <Download className="w-4 h-4 mr-2" />
              {isSyncing ? 'Syncing...' : `Sync ${globalFileSelection.size} File${globalFileSelection.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {/* Account Info Display */}
      {accountInfo && showDetailedDebug && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium mb-2 text-primary">Account Information:</h4>
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
          <h4 className="text-sm font-medium mb-2 text-primary">Enhanced Debug Information:</h4>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{debugInfo}</pre>
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
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
                          <Button size="sm" onClick={async () => {
                            // Load folder contents if not already loaded
                            if (!folderContents.has(folder.path_lower)) {
                              await loadFolderContents(folder.path_lower);
                            }
                            // Get all files from this folder
                            const files = folderContents.get(folder.path_lower) || [];
                            if (files.length > 0) {
                              // Auto-import all files from this folder
                              const filesToSync = files;
                              // Set selected files temporarily for syncFiles to work
                              const fileSelection = new Map();
                              files.forEach(file => fileSelection.set(file.path_lower, file));
                              setGlobalFileSelection(fileSelection);
                              // Trigger sync immediately
                              await syncFiles();
                            } else {
                              toast({
                                title: "No Files",
                                description: "No audio files found in this folder.",
                                variant: "destructive",
                              });
                            }
                          }}>
                            Import All
                          </Button>
                        </div>
                      </div>
                      
                      {/* Expanded folder contents */}
                      {expandedFolders.has(folder.path_lower) && (
                        <div className="border-t border-border px-3 pb-3">
                          {folderContents.get(folder.path_lower)?.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No audio files found</p>
                          ) : (
                            <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                              {folderContents.get(folder.path_lower)?.map((file) => (
                                <div key={file.path_lower} className="flex items-center justify-between p-2 rounded hover:bg-muted/30">
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
                    Make sure you have audio files (.mp3, .wav, .m4a, .aif, .aiff, .flac, .aac, .ogg, .wma) in the selected folder
                  </p>
                </div>
              ) : (
                <div>
                   <div className="flex items-center justify-between mb-4">
                     <div className="space-y-2">
                       <p className="text-sm text-muted-foreground">
                         Found {files.length} music file{files.length !== 1 ? 's' : ''} in selected folder
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
                                 setSelectedFiles(new Set(files.map(f => f.path_lower)));
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
                       {isSyncing ? 'Syncing...' : `Sync ${selectedFiles.size > 0 ? selectedFiles.size : files.length} File${selectedFiles.size === 1 || files.length === 1 ? '' : 's'}`}
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
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Resize handle indicator */}
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
