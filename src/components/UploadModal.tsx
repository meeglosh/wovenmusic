import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, AlertTriangle, CheckCircle, Music, FileX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioQuality: string;
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

export default function UploadModal({ open, onOpenChange, audioQuality }: UploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUnsupportedDialog, setShowUnsupportedDialog] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addTrackMutation = useAddTrack();
  const { toast } = useToast();

  const validateFileType = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const extension = '.' + fileName.split('.').pop();
    return SUPPORTED_FORMATS.includes(extension);
  };

  const isUnsupportedFormat = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const extension = '.' + fileName.split('.').pop();
    return UNSUPPORTED_FORMATS.includes(extension);
  };

  const getOutputFormat = (quality: string): 'mp3' | 'aac' | 'alac' => {
    switch (quality) {
      case 'aac-320':
        return 'aac';
      case 'lossless':
      case 'Best (Lossless)':
        return 'alac';
      default:
        return 'mp3';
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const supportedFiles: File[] = [];
    const unsupportedFiles: File[] = [];

    files.forEach(file => {
      if (isUnsupportedFormat(file)) {
        unsupportedFiles.push(file);
      } else if (validateFileType(file)) {
        supportedFiles.push(file);
      } else {
        unsupportedFiles.push(file);
      }
    });

    if (unsupportedFiles.length > 0) {
      setUnsupportedFiles(unsupportedFiles);
      setShowUnsupportedDialog(true);
    }

    if (supportedFiles.length > 0) {
      const newUploadFiles: UploadFile[] = supportedFiles.map(file => ({
        file,
        status: 'pending',
        progress: 0
      }));
      setUploadFiles(prev => [...prev, ...newUploadFiles]);
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

const removeFile = (index: number) => {
  setUploadFiles(prev => prev.filter((_, i) => i !== index));
};

const getDurationFromFile = (file: File): Promise<number> => {
  console.log(`Getting duration for file: ${file.name}, type: ${file.type}, size: ${file.size}`);

  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = (duration?: number) => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(url);
        console.log(`Duration extracted for ${file.name}: ${duration || 'fallback to 180'}`);
        resolve(duration || 180);
      }
    };

    audio.addEventListener('loadedmetadata', () => {
      console.log(`Loadedmetadata for ${file.name}: duration = ${audio.duration}`);
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        cleanup(audio.duration);
      } else {
        console.log(`Invalid duration for ${file.name}, using fallback`);
        cleanup();
      }
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

    setTimeout(() => {
      console.log(`Timeout reached for ${file.name}`);
      cleanup();
    }, 10000);

    audio.preload = 'metadata';
    audio.src = url;
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
        resolve(duration || 180);
      }
    };

    audio.addEventListener('loadedmetadata', () => {
      console.log(`Loadedmetadata from URL: duration = ${audio.duration}`);
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        cleanup(audio.duration);
      } else {
        console.log(`Invalid duration from URL, using fallback`);
        cleanup();
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

const extractMetadata = (filename: string) => {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const parts = nameWithoutExt.split(' - ');

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts[1].trim()
    };
  } else {
    return {
      artist: 'Unknown Artist',
      title: nameWithoutExt.trim()
    };
  }
};

const startUpload = async () => {
  if (uploadFiles.length === 0) return;
  setIsUploading(true);

  let successCount = 0;

  try {
    for (let i = 0; i < uploadFiles.length; i++) {
      if (uploadFiles[i].status === 'pending') {
        await uploadFile(uploadFiles[i], i);

        const updatedFile = uploadFiles[i];
        if (updatedFile.status === 'success') {
          successCount++;
        }
      }
    }

    toast({
      title: "Upload complete",
      description: `Successfully imported ${successCount}/${uploadFiles.length} audio file(s).`,
    });
  } catch (error) {
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
    case 'transcoding':
    case 'importing':
      return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
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
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
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
                          • {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>

                        {(uploadFile.status === 'uploading' || uploadFile.status === 'transcoding' || uploadFile.status === 'importing') && (
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
          aria-label="Select audio files"
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
