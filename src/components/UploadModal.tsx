import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, AlertTriangle, CheckCircle, Music, FileX } from "lucide-react";
import { useAddTrack } from "@/hooks/useTracks";
import { useToast } from "@/hooks/use-toast";
import { importTranscodingService } from "@/services/importTranscodingService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Prefer app API base, else fall back to transcode server URL */
const APP_API_BASE =
  (import.meta as any)?.env?.VITE_APP_API_BASE ||
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioQuality: string; // 'mp3-320' | 'aac-320' (etc.)
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'transcoding' | 'importing' | 'success' | 'error';
  progress: number;
  error?: string;
  trackId?: string;
}

const SUPPORTED_FORMATS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.aif', '.aiff'];
const UNSUPPORTED_FORMATS: string[] = [];

/** Strict local extension check so MP3s never show 'Transcoding' */
const ext = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};
const SHOULD_TRANSCODE = new Set(['.wav', '.aif', '.aiff', '.flac']); // never transcode mp3/m4a/aac

export default function UploadModal({ open, onOpenChange, audioQuality }: UploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUnsupportedDialog, setShowUnsupportedDialog] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addTrackMutation = useAddTrack();
  const { toast } = useToast();

  const validateFileType = (file: File): boolean => {
    const e = ext(file.name);
    return SUPPORTED_FORMATS.includes(e);
  };

  const isUnsupportedFormat = (file: File): boolean => {
    const e = ext(file.name);
    return UNSUPPORTED_FORMATS.includes(e);
  };

  const handleFileSelect = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = (files: File[]) => {
    if (files.length === 0) return;

    const supported: File[] = [];
    const unsupported: File[] = [];

    files.forEach(file => {
      if (isUnsupportedFormat(file)) unsupported.push(file);
      else if (validateFileType(file)) supported.push(file);
      else unsupported.push(file);
    });

    if (unsupported.length > 0) {
      setUnsupportedFiles(unsupported);
      setShowUnsupportedDialog(true);
    }

    if (supported.length > 0) {
      const newUploadFiles: UploadFile[] = supported.map(file => ({
        file,
        status: 'pending',
        progress: 0
      }));
      setUploadFiles(prev => [...prev, ...newUploadFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removeFile = (index: number) => setUploadFiles(prev => prev.filter((_, i) => i !== index));

  const getDurationFromUrl = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      let settled = false;
      const done = (val?: number) => {
        if (settled) return;
        settled = true;
        resolve(val && !isNaN(val) && val > 0 ? val : 180); // fallback 3:00
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
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const extractMetadata = (filename: string) => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const parts = nameWithoutExt.split(' - ');
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts[1].trim() };
    }
    return { artist: 'Unknown Artist', title: nameWithoutExt.trim() };
  };

  /**
   * Try the modern endpoint first, then legacy.
   * Success == persistent R2 handle: storage_key (preferred) OR public R2 URL.
   */
  const processOnServer = async (file: File, desiredQuality: string) => {
    const tryPost = async (path: string, body: FormData) => {
      const url = `${APP_API_BASE}${path}`;
      console.log(`[upload] POST ${url}`);
      const res = await fetch(url, { method: "POST", body, credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(`${path.replace("/api/", "")} failed ${res.status}: ${text}`);
        (err as any).status = res.status;
        throw err;
      }
      return res.json();
    };

    // Build a flexible payload that works for both handlers
    const form = new FormData();
    form.append("audio", file);
    form.append("fileName", file.name);
    // For modern handler:
    form.append("quality", desiredQuality); // e.g., 'mp3-320'
    // For legacy handler:
    form.append("outputFormat", desiredQuality.startsWith("aac") ? "aac" : "mp3");
    form.append("bitrate", "320k");

    // 1) Preferred modern route
    try {
      const data = await tryPost("/api/process-upload", form);
      return { data, used: "process-upload" as const };
    } catch (e: any) {
      if (e.status !== 404) throw e;
      console.warn("[upload] /api/process-upload not found, falling back to /api/transcode");
    }

    // 2) Legacy route that should still store into R2
    const data = await tryPost("/api/transcode", form);
    return { data, used: "transcode" as const };
  };

  const uploadFile = async (uploadFile: UploadFile, index: number) => {
    const { file } = uploadFile;
    const e = ext(file.name);
    const shouldTranscode = SHOULD_TRANSCODE.has(e);
    const desiredQuality = audioQuality || 'mp3-320';

    try {
      setUploadFiles(prev => prev.map((f, i) => i === index ? ({ ...f, status: 'uploading', progress: 10 }) : f));

      // Only show "Transcoding" for formats that truly need it
      if (shouldTranscode) {
        setUploadFiles(prev => prev.map((f, i) => i === index ? ({ ...f, status: 'transcoding', progress: 40 }) : f));
      }

      const { data, used } = await processOnServer(file, desiredQuality);
      console.log("[upload] server response from", used, data);

      // Accept multiple possible shapes:
      // - Modern: { storage_key, storage_bucket, url? }
      // - Legacy: { storage_key?, storage_bucket?, publicUrl? or url? }
      const storage_key = data.storage_key || data.storageKey;
      const storage_bucket = data.storage_bucket || data.bucket || data.bucketName;
      const returnedUrl = data.url || data.publicUrl;

      // Require either a storage_key (preferred) or an R2 public URL.
      if (!storage_key && !returnedUrl) {
        throw new Error("Server did not return a persistent R2 handle (storage_key or public URL).");
      }

      setUploadFiles(prev => prev.map((f, i) => i === index ? ({ ...f, status: 'importing', progress: 80 }) : f));

      // Use the (temporary or public) url to sniff duration for the track row
      const sniffUrl = returnedUrl;
      const secs = sniffUrl ? await getDurationFromUrl(sniffUrl) : 180;
      const formattedDuration = formatDuration(secs);
      const { artist, title } = extractMetadata(file.name);

      // Build track data: new R2-first fields; do NOT save Supabase file_url
      const trackData: any = {
        title,
        artist,
        duration: formattedDuration,
        storage_type: 'r2',
        storage_key: storage_key ?? null,
        storage_url: storage_key ? null : (returnedUrl ?? null), // if no key, fall back to public URL
        fileUrl: null,
        source_folder: 'Direct Upload',
        is_public: false,
      };

      const created = await addTrackMutation.mutateAsync(trackData);

      setUploadFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, status: 'success', progress: 100, trackId: created.id } : f
      ));
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, status: 'error', error: error.message || 'Upload failed' } : f
      ));
    }
  };

  const startUpload = async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        if (uploadFiles[i].status === 'pending') {
          await uploadFile(uploadFiles[i], i);
        }
      }

      toast({
        title: "Upload complete",
        description: `Finished processing selected audio file(s).`,
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Some files failed to upload. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <Music className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'transcoding':
        return null; // center spinner shown in text line
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <FileX className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusText = (uploadFile: UploadFile) => {
    switch (uploadFile.status) {
      case 'pending': return 'Ready to upload';
      case 'uploading': return 'Uploading file...';
      case 'transcoding': return 'Transcoding audio...';
      case 'importing': return 'Finalizing import...';
      case 'success': return 'Upload complete';
      case 'error': return uploadFile.error || 'Upload failed';
      default: return '';
    }
  };

  const allComplete = uploadFiles.length > 0 && uploadFiles.every(f => f.status === 'success' || f.status === 'error');
  const hasSuccessful = uploadFiles.some(f => f.status === 'success');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">Cast waveforms into the current</DialogTitle>
            <DialogDescription className="sr-only">
              Upload audio files to R2 storage. MP3/AAC files upload as-is; WAV/AIFF/FLAC are transcoded.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Upload Area */}
            <Card
              className={`border-2 border-dashed transition-colors ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Upload className={`h-12 w-12 mb-4 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                <Button onClick={handleFileSelect} variant="outline" className="mb-2">
                  Select Audio Files
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Drag and drop audio files here, or click to select files
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {SUPPORTED_FORMATS.map(format => (
                    <Badge key={format} variant="secondary" className="text-xs">
                      {format.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* File List */}
            {uploadFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-primary">Files to Upload ({uploadFiles.length})</h3>
                  {!isUploading && uploadFiles.some(f => f.status === 'pending') && (
                    <Button onClick={startUpload} size="sm">
                      Start Upload
                    </Button>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {uploadFiles.map((uploadFile, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(uploadFile.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            {getStatusText(uploadFile)}
                            {uploadFile.status === 'transcoding' && (
                              <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                            )}
                            • {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>

                          {(uploadFile.status === 'uploading' || uploadFile.status === 'transcoding') && (
                            <Progress value={uploadFile.progress} className="h-1 mt-1" />
                          )}
                        </div>
                        {uploadFile.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-primary hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setUploadFiles([])}>
                <span className="text-primary">Clear All</span>
              </Button>
              <div className="space-x-2">
                {allComplete && hasSuccessful && (
                  <Button onClick={() => onOpenChange(false)} variant="default">
                    Done
                  </Button>
                )}
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-primary">
                  {allComplete ? 'Close' : 'Cancel'}
                </Button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={SUPPORTED_FORMATS.join(',')}
            onChange={handleFileChange}
            className="hidden"
          />
        </DialogContent>
      </Dialog>

      {/* Unsupported Files Dialog */}
      <AlertDialog open={showUnsupportedDialog} onOpenChange={setShowUnsupportedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsupported File Format
            </AlertDialogTitle>
            <AlertDialogDescription>
              The following files are not supported and cannot be uploaded:
              <div className="mt-3 space-y-2">
                {unsupportedFiles.map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded">
                    <FileX className="h-4 w-4 text-destructive" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
