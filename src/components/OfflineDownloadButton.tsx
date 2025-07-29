import React from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Trash2, Wifi, WifiOff } from "lucide-react";
import { Track, Playlist } from "@/types/music";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { isOnline } from "@/services/offlineStorageService";
import { cn } from "@/lib/utils";

interface OfflineDownloadButtonProps {
  track?: Track;
  playlist?: Playlist;
  tracks?: Track[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const OfflineDownloadButton: React.FC<OfflineDownloadButtonProps> = ({
  track,
  playlist,
  tracks = [],
  variant = "outline",
  size = "sm",
  className
}) => {
  const {
    isInitialized,
    isTrackDownloaded,
    isPlaylistDownloaded,
    downloadTrack,
    downloadPlaylist,
    removeTrack,
    removePlaylist,
    isDownloading,
    isRemoving
  } = useOfflineStorage();

  if (!isInitialized || !('caches' in window)) {
    return null;
  }

  const online = isOnline();

  if (track) {
    const downloaded = isTrackDownloaded(track.id);
    
    return (
      <Button
        variant={variant}
        size={size}
        className={cn(
          "flex items-center gap-2",
          downloaded && "text-green-600 border-green-600",
          className
        )}
        onClick={() => {
          if (downloaded) {
            removeTrack(track.id);
          } else {
            downloadTrack(track);
          }
        }}
        disabled={isDownloading || isRemoving || (!online && !downloaded)}
        title={
          !online && !downloaded 
            ? "Connect to internet to download" 
            : downloaded 
              ? "Remove from device" 
              : "Download for offline playback"
        }
      >
        {!online && !downloaded ? (
          <WifiOff className="h-4 w-4" />
        ) : downloaded ? (
          <>
            <CheckCircle className="h-4 w-4" />
            {size !== "icon" && "Downloaded"}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            {size !== "icon" && "Download"}
          </>
        )}
      </Button>
    );
  }

  if (playlist) {
    const downloaded = isPlaylistDownloaded(playlist);
    const playlistTracks = tracks.filter(t => playlist.trackIds.includes(t.id));
    
    return (
      <Button
        variant={variant}
        size={size}
        className={cn(
          "flex items-center gap-2",
          downloaded && "text-green-600 border-green-600",
          className
        )}
        onClick={() => {
          if (downloaded) {
            removePlaylist(playlist.id);
          } else {
            downloadPlaylist({ playlist, tracks: playlistTracks });
          }
        }}
        disabled={isDownloading || isRemoving || (!online && !downloaded) || playlistTracks.length === 0}
        title={
          playlistTracks.length === 0
            ? "No tracks in playlist"
            : !online && !downloaded 
              ? "Connect to internet to download" 
              : downloaded 
                ? "Remove playlist from device" 
                : "Download playlist for offline playback"
        }
      >
        {!online && !downloaded ? (
          <WifiOff className="h-4 w-4" />
        ) : downloaded ? (
          <>
            <CheckCircle className="h-4 w-4" />
            {size !== "icon" && "Downloaded"}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            {size !== "icon" && "Download Playlist"}
          </>
        )}
      </Button>
    );
  }

  return null;
};