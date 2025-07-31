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

export const DropboxSyncAccordion = ({ isExpanded = false, onExpandedChange, onPendingTracksChange }: DropboxSyncAccordionProps) => {
  // -- state & hooks --
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

  // -- helper fns: durations, sorting, formatting -- (unchanged)
  // ...

  // -- core actions --
  const checkConnection = async () => { /* ... */ };
  const handleConnect = async () => { /* ... */ };
  const handleDisconnect = async () => { /* ... */ };
  const loadFolders = async (path: string = "") => { /* ... */ };
  const syncSelectedFiles = async () => { /* ... */ };

  // -- effects --
  useEffect(() => {
    if (isExpanded) { /* ... load root folder ... */ }
  }, [isExpanded]);

  useEffect(() => {
    // handle dropboxAuthRefreshed
  }, [isExpanded, currentPath]);

  useEffect(() => {
    // resort on sortOrder change
  }, [sortOrder]);

  useEffect(() => {
    // convert importProgress to pendingTracks
  }, [importProgress, onPendingTracksChange]);

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
          {/* header trigger only */}
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
          {/* content block no extra triggers */}
          {/* connection status, sorting, navigation, file/folder lists, import UI */}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
