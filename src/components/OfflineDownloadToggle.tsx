import React, { useState, useEffect } from "react";
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

  // local checked state mirrors the hook’s downloaded flag
  const [checked, setChecked] = useState(false);

  // don’t render until our service is ready
  if (!isInitialized || !("caches" in window)) {
    return null;
  }

  const online = isOnline();
  const downloaded = isPlaylistDownloaded(playlist);
  const playlistTracks = tracks.filter((t) =>
    playlist.trackIds.includes(t.id)
  );

  // whenever the underlying downloaded state changes, sync local switch
  useEffect(() => {
    setChecked(downloaded);
  }, [downloaded]);

  const handleToggleChange = async (newChecked: boolean) => {
    console.log("🔄 handleToggleChange – newChecked:", newChecked, "downloaded:", downloaded);

    if (newChecked && !downloaded) {
      // Download playlist
      if (!online || playlistTracks.length === 0) {
        return;
      }
      // Fire off mutateAsync and optimistically flip UI
      setChecked(true);
      try {
        await downloadPlaylist({ playlist, tracks: playlistTracks });
      } catch {
        // if it fails, revert UI
        setChecked(false);
      }
    } else if (!newChecked && downloaded) {
      // Remove playlist
      setChecked(false);
      try {
        await removePlaylist(playlist.id);
      } catch {
        // if it fails, revert UI
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
