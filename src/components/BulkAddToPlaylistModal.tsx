import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreatePlaylist, usePlaylists, useAddTrackToPlaylist } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/use-toast";
import { Track, getFileName } from "@/types/music";
import { Search, Music, Plus, ListMusic, Upload } from "lucide-react";

interface BulkAddToPlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTracks: Track[];
}

const BulkAddToPlaylistModal = ({ 
  open, 
  onOpenChange, 
  selectedTracks 
}: BulkAddToPlaylistModalProps) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  
  const { data: playlists = [] } = usePlaylists();
  const createPlaylistMutation = useCreatePlaylist();
  const addTrackMutation = useAddTrackToPlaylist();
  const { toast } = useToast();

  // Filter playlists based on search query
  const filteredPlaylists = playlists.filter(playlist => 
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToExistingPlaylist = async () => {
    if (!selectedPlaylistId || selectedTracks.length === 0) return;

    setIsLoading(true);
    
    try {
      // Add tracks sequentially to ensure proper order
      for (const track of selectedTracks) {
        await addTrackMutation.mutateAsync({ 
          playlistId: selectedPlaylistId, 
          trackId: track.id 
        });
      }
      
      const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
      toast({
        title: "Tracks added!",
        description: `${selectedTracks.length} track${selectedTracks.length !== 1 ? 's' : ''} added to "${selectedPlaylist?.name}".`,
      });
      
      handleClose();
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

  const handleCreatePlaylistAndAdd = async () => {
    if (!newPlaylistName.trim() || selectedTracks.length === 0) return;

    setIsLoading(true);
    
    try {
      // Create new playlist
      const newPlaylist = await createPlaylistMutation.mutateAsync(newPlaylistName.trim());
      
      // Add tracks to the new playlist
      for (const track of selectedTracks) {
        await addTrackMutation.mutateAsync({ 
          playlistId: newPlaylist.id, 
          trackId: track.id 
        });
      }
      
      toast({
        title: "Playlist created and tracks added!",
        description: `Created "${newPlaylistName}" with ${selectedTracks.length} track${selectedTracks.length !== 1 ? 's' : ''}.`,
      });
      
      handleClose();
    } catch (error) {
      console.error("Error creating playlist and adding tracks:", error);
      toast({
        title: "Error creating playlist",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedPlaylistId("");
    setNewPlaylistName("");
    setSearchQuery("");
    setActiveTab("existing");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add {selectedTracks.length} Track{selectedTracks.length !== 1 ? 's' : ''} to Playlist
          </DialogTitle>
          <DialogDescription>
            Choose an existing playlist or create a new one to add your selected tracks.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Selected Tracks Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Music className="w-4 h-4" />
                Selected Tracks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedTracks.slice(0, 3).map((track) => (
                  <Badge key={track.id} variant="secondary" className="text-xs">
                    {getFileName(track)}
                  </Badge>
                ))}
                {selectedTracks.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedTracks.length - 3} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="flex items-center gap-2">
                <ListMusic className="w-4 h-4" />
                Existing Playlist
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create New
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="existing" className="space-y-4">
              {/* Search Existing Playlists */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search playlists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Playlist List */}
              <ScrollArea className="h-[300px] border rounded-md">
                {filteredPlaylists.length === 0 ? (
                  <div className="text-center py-8">
                    {playlists.length === 0 ? (
                      <>
                        <ListMusic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No playlists found. Create your first playlist!</p>
                      </>
                    ) : (
                      <>
                        <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No playlists found matching "{searchQuery}"</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {filteredPlaylists.map((playlist) => (
                      <Card 
                        key={playlist.id}
                        className={`cursor-pointer transition-colors ${
                          selectedPlaylistId === playlist.id 
                            ? 'bg-primary/10 border-primary' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{playlist.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {playlist.trackIds.length} track{playlist.trackIds.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            {selectedPlaylistId === playlist.id && (
                              <Badge className="bg-primary text-primary-foreground">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="new" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Create New Playlist</CardTitle>
                  <CardDescription>
                    Create a new playlist and add your selected tracks to it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="playlist-name">Playlist Name</Label>
                    <Input
                      id="playlist-name"
                      placeholder="Enter playlist name..."
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
          {activeTab === "existing" ? (
            <Button 
              onClick={handleAddToExistingPlaylist} 
              disabled={isLoading || !selectedPlaylistId || selectedTracks.length === 0}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add to Playlist`
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleCreatePlaylistAndAdd} 
              disabled={isLoading || !newPlaylistName.trim() || selectedTracks.length === 0}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create & Add`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddToPlaylistModal;