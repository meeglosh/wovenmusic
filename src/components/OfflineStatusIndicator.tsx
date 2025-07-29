import React from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Download } from "lucide-react";
import { isOnline } from "@/services/offlineStorageService";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";

export const OfflineStatusIndicator: React.FC = () => {
  const online = isOnline();
  const { downloadedTracks, isInitialized } = useOfflineStorage();

  if (!isInitialized) return null;

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={online ? "default" : "secondary"} 
        className="flex items-center gap-1"
      >
        {online ? (
          <>
            <Wifi className="h-3 w-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>
      
      {downloadedTracks.length > 0 && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {downloadedTracks.length} downloaded
        </Badge>
      )}
    </div>
  );
};