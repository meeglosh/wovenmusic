// /Users/mjerugim/wovenmusic/src/components/DropboxSyncAccordion.tsx
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
  ArrowDown,
  Link,
  Unlink
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import DropboxIcon from "@/components/icons/DropboxIcon";
import { dropboxService } from "@/services/dropboxService";
import { useAddTrack } from "@/hooks/useTracks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { importTranscodingService } from "@/services/importTranscodingService";
import { FileImportStatus, ImportProgress } from "@/types/fileImport";

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

export const DropboxSyncAccordion = ({
  isExpanded = false,
  onExpandedChange,
  onPendingTracksChange
}: DropboxSyncAccordionProps) => {
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

  // … all helper functions unchanged …

  // when accordion is first expanded, load root
  useEffect(() => {
    if (isExpanded) {
      checkConnection().then(connected => {
        if (connected && files.length === 0 && folders.length === 0 && !isLoading) {
          loadFolders();
        }
      });
    }
  }, [isExpanded]);

  // … other effects …

  const accordionValue = isExpanded ? "dropbox-sync" : "";

  return (
    <Accordion 
      type="single" 
      value={accordionValue}
      onValueChange={v => onExpandedChange?.(v === "dropbox-sync")}
      className="w-full"
    >
      <AccordionItem value="dropbox-sync" className="border rounded-lg">
        {/* hide the built-in caret on this trigger */}
        <AccordionTrigger noChevron className="px-4 py-3 hover:no-underline">
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
            {/* Connection Status and Controls */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <Link className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">
                      Connected to Dropbox
                    </span>
                  </>
                ) : (
                  <>
                    <Unlink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Not connected to Dropbox
                    </span>
                  </>
                )}
              </div>
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="text-primary hover:text-primary/80"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex items-center gap-2"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect to Dropbox'
                  )}
                </Button>
              )}
            </div>

            {/* … the rest of your content … */}

          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
