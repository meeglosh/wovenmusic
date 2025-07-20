import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileAudio, ArrowRight } from "lucide-react";

interface UnsupportedFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  unsupportedFiles: string[];
  supportedCount: number;
}

export const UnsupportedFilesModal = ({ 
  isOpen, 
  onClose, 
  unsupportedFiles, 
  supportedCount 
}: UnsupportedFilesModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Unsupported File Format
          </DialogTitle>
          <DialogDescription className="space-y-4">
            <div>
              We found <strong>{unsupportedFiles.length}</strong> .aif/.aiff file(s) that can't be imported into Wovenmusic. 
              These files need to be converted to supported formats first.
            </div>
            
            {supportedCount > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <FileAudio className="h-4 w-4" />
                  <span className="font-medium">Good news!</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {supportedCount} supported file(s) were successfully imported.
                </p>
              </div>
            )}
            
            <div>
              <h4 className="font-medium mb-2 text-primary">Supported formats:</h4>
              <div className="flex flex-wrap gap-1">
                {['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'].map(format => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <strong>To convert your .aif files:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Use audio software like Audacity, iTunes, or online converters</li>
                <li>Convert to .wav or .mp3 format</li>
                <li>Re-sync the converted files</li>
              </ol>
            </div>
            
            {unsupportedFiles.length <= 5 && (
              <div>
                <h4 className="font-medium mb-2 text-primary">Unsupported files:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {unsupportedFiles.map((filename, index) => (
                    <div key={index} className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      {filename}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-end">
          <Button onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};