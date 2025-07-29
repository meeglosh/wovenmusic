import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trash2, Download, Wifi, WifiOff, HardDrive } from "lucide-react";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { formatFileSize, isOnline } from "@/services/offlineStorageService";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface OfflineStorageManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OfflineStorageManager: React.FC<OfflineStorageManagerProps> = ({
  open,
  onOpenChange
}) => {
  const {
    downloadedTracks,
    downloadedPlaylists,
    storageSize,
    removeTrack,
    removePlaylist,
    clearAllOfflineData,
    isRemoving
  } = useOfflineStorage();

  const [showClearDialog, setShowClearDialog] = useState(false);
  const online = isOnline();

  const handleClearAll = () => {
    clearAllOfflineData();
    setShowClearDialog(false);
  };

  // Calculate storage usage as percentage (assuming 1GB limit for display)
  const storageLimit = 1024 * 1024 * 1024; // 1GB
  const storagePercentage = Math.min((storageSize / storageLimit) * 100, 100);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Offline Storage Manager
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {online ? (
                    <>
                      <Wifi className="h-5 w-5 text-green-600" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-5 w-5 text-red-600" />
                      Offline
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {online 
                    ? "You can download tracks and playlists for offline playback"
                    : "You're offline. Only downloaded tracks can be played"
                  }
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Storage Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Usage</CardTitle>
                <CardDescription>
                  Local storage used for offline tracks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>{formatFileSize(storageSize)} used</span>
                    <span>{downloadedTracks.length} tracks</span>
                  </div>
                  <Progress value={storagePercentage} className="w-full" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {downloadedPlaylists.length} playlists downloaded
                    </span>
                    {storageSize > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowClearDialog(true)}
                        disabled={isRemoving}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Downloaded Playlists */}
            {downloadedPlaylists.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Downloaded Playlists</CardTitle>
                  <CardDescription>
                    Playlists available for offline playback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {downloadedPlaylists.map((playlist) => (
                      <div key={playlist.playlistId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">Playlist {playlist.playlistId}</div>
                          <div className="text-sm text-muted-foreground">
                            {playlist.trackIds.length} tracks • Downloaded {playlist.downloadedAt.toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removePlaylist(playlist.playlistId)}
                          disabled={isRemoving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Downloaded Tracks */}
            {downloadedTracks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Individual Downloaded Tracks</CardTitle>
                  <CardDescription>
                    Tracks downloaded separately from playlists
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {downloadedTracks.map((track) => (
                      <div key={track.trackId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">Track {track.trackId}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(track.fileSize)} • Downloaded {track.downloadedAt.toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeTrack(track.trackId)}
                          disabled={isRemoving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {downloadedTracks.length === 0 && downloadedPlaylists.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Offline Content</h3>
                    <p className="text-muted-foreground">
                      Download tracks and playlists to listen offline. Look for the download button on tracks and playlists.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Help Text */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>How it works:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Downloaded tracks are stored locally in your browser</li>
                    <li>Offline tracks work even without internet connection</li>
                    <li>Clear browsing data will remove all downloads</li>
                    <li>Downloads are only available on this device</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Offline Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {downloadedTracks.length} downloaded tracks and {downloadedPlaylists.length} playlists from your device. 
              You'll need to re-download them to play offline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};