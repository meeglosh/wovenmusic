// src/components/OfflineDownloadToggle.tsx
import React, { useState } from "react";
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
  tracks,
}) => {
  const {
    isInitialized,
    isPlaylistDownloaded,
    downloadPlaylist,
    removePlaylist,
    isDownloading,
    isRemoving,
  } = useOfflineStorage();

  // 1) local toggle state, seeded from the RQ-driven flag
  const [checked, setChecked] = useState(() =>
    isPlaylistDownloaded(playlist)
  );

  // Bail out until service is ready
  if (!isInitialized || !("caches" in window)) {
    return null;
  }

  const online = isOnline();
  const playlistTracks = tracks.filter((t) =>
    playlist.trackIds.includes(t.id)
  );

  const handleToggleChange = async (newChecked: boolean) => {
    // immediately update UI
    setChecked(newChecked);

    if (newChecked) {
      // DOWNLOAD
      if (!online || playlistTracks.length === 0) {
        // revert if we can't
        setChecked(false);
        return;
      }
      try {
        // mutateAsync triggers onSuccess toast every time
        await downloadPlaylist({ playlist, tracks: playlistTracks });
        // local state already “on”
      } catch {
        setChecked(false);
      }
    } else {
      // REMOVE
      try {
        await removePlaylist(playlist.id);
        // local state already “off”
      } catch {
        setChecked(true);
      }
    }
  };

  const isDisabled =
    isDownloading ||
    isRemoving ||
    (!online && !checked) ||
    playlistTracks.length === 0;

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <Label htmlFor="playlist-download" className="text-sm font-medium">
            Download for offline playback
          </Label>
          <p className="text-xs text-muted-foreground break-words">
            {!online && !checked ? (
              <span className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Connect to internet to download
              </span>
            ) : playlistTracks.length === 0 ? (
              "No tracks in playlist"
            ) : checked ? (
              "Playlist available offline"
            ) : (
              "Download this playlist for offline listening"
            )}
          </p>
        </div>
        <Switch
          id="playlist-download"
          checked={checked}
          onCheckedChange={handleToggleChange}
          disabled={isDisabled}
          className="flex-shrink-0"
        />
      </div>
    </Card>
  );
};
