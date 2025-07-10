
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, MoreHorizontal, Clock, Trash2, X } from "lucide-react";
import { Track, getFileName } from "@/types/music";
import DropboxSync from "./DropboxSync";
import { useDeleteTrack, useBulkDeleteTracks } from "@/hooks/useDeleteTrack";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MusicLibraryProps {
  tracks: Track[];
  onPlayTrack: (track: Track, playlist?: Track[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
}

const MusicLibrary = ({ tracks, onPlayTrack, currentTrack, isPlaying }: MusicLibraryProps) => {
  const navigate = useNavigate();
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const deleteTrackMutation = useDeleteTrack();
  const bulkDeleteMutation = useBulkDeleteTracks();
  const { toast } = useToast();

  const isSelectionMode = selectedTrackIds.size > 0;
  const allTracksSelected = tracks.length > 0 && selectedTrackIds.size === tracks.length;
  const someTracksSelected = selectedTrackIds.size > 0 && selectedTrackIds.size < tracks.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrackIds(new Set(tracks.map(track => track.id)));
    } else {
      setSelectedTrackIds(new Set());
    }
  };

  const handleSelectTrack = (trackId: string, checked: boolean) => {
    const newSelection = new Set(selectedTrackIds);
    if (checked) {
      newSelection.add(trackId);
    } else {
      newSelection.delete(trackId);
    }
    setSelectedTrackIds(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedTrackIds(new Set());
  };

  const handleDeleteTrack = async (track: Track) => {
    try {
      await deleteTrackMutation.mutateAsync(track.id);
      toast({
        title: "Track removed",
        description: `"${track.title}" has been removed from your library. The file remains in your Dropbox.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove track from library.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedTrackIds);
    try {
      await bulkDeleteMutation.mutateAsync(selectedIds);
      setSelectedTrackIds(new Set());
      toast({
        title: "Tracks removed",
        description: `${selectedIds.length} tracks have been removed from your library. The files remain in your Dropbox.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove tracks from library.",
        variant: "destructive",
      });
    }
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Your Library</h2>
        <div className="flex items-center space-x-4">
          {isSelectionMode && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {selectedTrackIds.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
              >
                <X className="w-4 h-4 mr-2" />
                Clear Selection
              </Button>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Dropbox Sync Section */}
      <DropboxSync />

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <div className="text-2xl text-primary/60">♪</div>
            </div>
            <h3 className="text-xl font-semibold mb-2">No tracks yet</h3>
            <p className="text-muted-foreground mb-4">Connect your Dropbox to sync your music library automatically.</p>
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[auto,auto,1fr,auto,auto,auto] gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="w-8">
              <Checkbox
                checked={allTracksSelected}
                onCheckedChange={handleSelectAll}
                className={someTracksSelected ? 'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground' : ''}
                data-indeterminate={someTracksSelected}
              />
            </div>
            <div className="w-12"></div>
            <div>Title</div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
            </div>
            <div>Added</div>
            <div className="w-12"></div>
          </div>

          <div className="divide-y divide-border">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className={`grid grid-cols-[auto,auto,1fr,auto,auto,auto] gap-4 p-4 hover:bg-muted/30 transition-colors group ${
                  selectedTrackIds.has(track.id) ? 'bg-muted/50' : ''
                }`}
              >
                <div className="w-8 flex items-center">
                  <Checkbox
                    checked={selectedTrackIds.has(track.id)}
                    onCheckedChange={(checked) => handleSelectTrack(track.id, checked as boolean)}
                  />
                </div>
                <div className="w-12 flex items-center">
                  {/* Show play/pause button based on current track and playing state */}
                  {currentTrack?.id === track.id && isPlaying ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onPlayTrack(track)}
                      title="Pause track"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                        !track.fileUrl || track.fileUrl === '#' ? 'cursor-not-allowed opacity-50' : ''
                      }`}
                      onClick={() => onPlayTrack(track)}
                      disabled={!track.fileUrl || track.fileUrl === '#'}
                      title={!track.fileUrl || track.fileUrl === '#' ? 'No audio file available' : 'Play track'}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </Button>
                  )}
                  <span className="text-muted-foreground text-sm group-hover:opacity-0 transition-opacity">
                    {index + 1}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20">
                    <div className="flex space-x-px">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary/60 wave-bar rounded-full"
                          style={{ height: `${Math.random() * 16 + 4}px` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <button 
                      className="text-left font-medium hover:text-primary transition-colors cursor-pointer"
                      onClick={() => navigate(`/track/${track.id}`)}
                      title="Open track view with comments"
                    >
                      {getFileName(track)}
                    </button>
                  </div>
                </div>

                <div className="flex items-center text-muted-foreground">
                  {track.duration}
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  {track.addedAt.toLocaleDateString()}
                </div>

                <div className="w-12 flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleDeleteTrack(track)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove from library
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MusicLibrary;
