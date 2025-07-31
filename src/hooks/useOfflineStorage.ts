import React from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WifiOff } from "lucide-react";
import { Track, Playlist } from "@/types/music";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { isOnline } from "@/services/offlineStorageService";

interface OfflineDownloadToggleProps {
  playlist: Playlist;
  tracks: Track[];
}

export const OfflineDownloadToggle: React.FC<OfflineDownloadToggleProps> = ({
  playlist,
  tracks
}) => {
  const {
    isInitialized,
    isPlaylistDownloaded,
    downloadPlaylist,
    removePlaylist,
    isDownloading,
    isRemoving
  } = useOfflineStorage();

  // don’t render until our service is ready
  if (!isInitialized || !("caches" in window)) {
    return null;
  }

  const online = isOnline();
  const downloaded = isPlaylistDownloaded(playlist);
  const playlistTracks = tracks.filter((t) =>
    playlist.trackIds.includes(t.id)
  );

  const handleToggleChange = (checked: boolean) => {
    if (checked && !downloaded) {
      // kick off the download mutation (toasts & state update happen in the hook)
      downloadPlaylist({ playlist, tracks: playlistTracks });
    } else if (!checked && downloaded) {
      // kick off the removal mutation
      removePlaylist(playlist.id);
    }
  };

  const isDisabled =
    isDownloading ||
    isRemoving ||
    (!online && !downloaded) ||
    playlistTracks.length === 0;

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <Label htmlFor="playlist-download" className="text-sm font-medium">
            Download for offline playback
          </Label>
          <p className="text-xs text-muted-foreground break-words">
            {!online && !downloaded ? (
              <span className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Connect to internet to download
              </span>
            ) : playlistTracks.length === 0 ? (
              "No tracks in playlist"
            ) : downloaded ? (
              "Preserve the signal for disconnected dreaming"
            ) : (
              "Preserve the signal for disconnected dreaming"
            )}
          </p>
        </div>
        <Switch
          id="playlist-download"
          checked={downloaded}
          onCheckedChange={handleToggleChange}
          disabled={isDisabled}
          className="flex-shrink-0"
        />
      </div>
    </Card>
  );
};
