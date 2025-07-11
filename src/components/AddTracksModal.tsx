import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAddTrackToPlaylist } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/use-toast";
import { Track, getFileName } from "@/types/music";
import { Search, Music, Plus } from "lucide-react";

interface AddTracksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  playlistName: string;
  allTracks: Track[];
  existingTrackIds: string[];
}

const AddTracksModal = ({ 
  open, 
  onOpenChange, 
  playlistId, 
  playlistName, 
  allTracks, 
  existingTrackIds 
}: AddTracksModalProps) => {
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addTrackMutation = useAddTrackToPlaylist();
  const { toast } = useToast();

  // Filter tracks that aren't already in the playlist
  const availableTracks = allTracks.filter(track => !existingTrackIds.includes(track.id));
  
  // Filter tracks based on search query
  const filteredTracks = availableTracks.filter(track => 
    getFileName(track).toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTrackSelect = (trackId: string, checked: boolean) => {
    if (checked) {
      setSelectedTracks(prev => [...prev, trackId]);
    } else {
      setSelectedTracks(prev => prev.filter(id => id !== trackId));
    }
  };

  const handleSelectAll = () => {
    if (selectedTracks.length === filteredTracks.length) {
      setSelectedTracks([]);
    } else {
      setSelectedTracks(filteredTracks.map(track => track.id));
    }
  };

  const handleAddTracks = async () => {
    if (selectedTracks.length === 0) return;

    setIsLoading(true);
    
    try {
      // Add tracks sequentially to ensure proper order
      for (const trackId of selectedTracks) {
        await addTrackMutation.mutateAsync({ playlistId, trackId });
      }
      
      toast({
        title: "Tracks added!",
        description: `${selectedTracks.length} track${selectedTracks.length !== 1 ? 's' : ''} added to "${playlistName}".`,
      });
      
      setSelectedTracks([]);
      setSearchQuery("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding tracks:", error);
      toast({
        title: "Error adding tracks",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTracks([]);
    setSearchQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add Tracks to "{playlistName}"
          </DialogTitle>
          <DialogDescription>
            Select tracks from your library to add to this playlist.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          {filteredTracks.length > 0 && (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-sm"
              >
                {selectedTracks.length === filteredTracks.length ? "Deselect All" : "Select All"}
              </Button>
              {selectedTracks.length > 0 && (
                <Badge variant="secondary">
                  {selectedTracks.length} selected
                </Badge>
              )}
            </div>
          )}

          {/* Track List */}
          <ScrollArea className="h-[400px] border rounded-md">
            {filteredTracks.length === 0 ? (
              <div className="text-center py-8">
                {availableTracks.length === 0 ? (
                  <>
                    <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">All tracks are already in this playlist!</p>
                  </>
                ) : (
                  <>
                    <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No tracks found matching "{searchQuery}"</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {filteredTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={track.id}
                      checked={selectedTracks.includes(track.id)}
                      onCheckedChange={(checked) => 
                        handleTrackSelect(track.id, checked as boolean)
                      }
                    />
                    
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20">
                      <div className="flex space-x-px">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-primary/60 rounded-full"
                            style={{ height: `${Math.random() * 16 + 4}px` }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getFileName(track)}</p>
                      <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {track.duration}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddTracks} 
            disabled={isLoading || selectedTracks.length === 0}
            className="min-w-[120px]"
          >
            {isLoading 
              ? "Adding..." 
              : `Add ${selectedTracks.length} Track${selectedTracks.length !== 1 ? 's' : ''}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddTracksModal;