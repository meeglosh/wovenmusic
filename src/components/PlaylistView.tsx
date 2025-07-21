
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Share2, Users, MoreHorizontal, Plus, GripVertical, Trash2, Edit, X, Upload, Image, Lock, Globe } from "lucide-react";
import { Track, Playlist, getCleanTitle, calculatePlaylistDuration } from "@/types/music";
import AddTracksModal from "./AddTracksModal";
import SharePlaylistModal from "./SharePlaylistModal";
import { useReorderPlaylistTracks, useRemoveTrackFromPlaylist, useUpdatePlaylist, useDeletePlaylist, useUploadPlaylistImage } from "@/hooks/usePlaylists";
import { useUpdatePlaylistVisibility } from "@/hooks/usePlaylistSharing";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlaylistViewProps {
  playlistId: string;
  onPlayTrack: (track: Track, playlist?: Track[]) => void;
  onBack: () => void;
}

// Import the hooks we need
import { usePlaylists } from "@/hooks/usePlaylists";
import { useTracks } from "@/hooks/useTracks";

// Sortable Track Item Component
interface SortableTrackItemProps {
  track: Track;
  index: number;
  onPlay: (track: Track, playlist?: Track[]) => void;
  onRemove: (trackId: string) => void;
  playlist: Track[];
  playlistImageUrl?: string;
}

const SortableTrackItem = ({ track, index, onPlay, onRemove, playlist, playlistImageUrl }: SortableTrackItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto,auto,1fr,auto,auto] gap-2 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors group border-b border-border last:border-b-0"
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="w-6 flex items-center cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Track Number / Play Button */}
      <div className="w-8 sm:w-12 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="w-6 h-6 sm:w-8 sm:h-8 p-0 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity"
          onClick={() => onPlay(track, playlist)}
        >
          <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
        </Button>
        <span className="text-muted-foreground text-xs sm:text-sm opacity-0 xl:opacity-100 xl:group-hover:opacity-0 transition-opacity">
          {index + 1}
        </span>
      </div>

      {/* Track Info */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded overflow-hidden hidden sm:block">
          {playlistImageUrl ? (
            <img 
              src={playlistImageUrl} 
              alt="Track thumbnail" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center border border-primary/20">
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
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate text-sm sm:text-base">{getCleanTitle(track)}</p>
        </div>
        {/* Privacy indicator */}
        <div className="flex-shrink-0" title={track.is_public ? "Public track" : "Private track"}>
          {track.is_public ? (
            <Globe className="w-4 h-4 text-green-500" />
          ) : (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
        {track.duration}
      </div>

      {/* Actions */}
      <div className="w-8 sm:w-12 flex items-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 sm:w-8 sm:h-8 p-0 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove track from playlist?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove "{getCleanTitle(track)}" from this playlist?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onRemove(track.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove from playlist
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const PlaylistView = ({ playlistId, onPlayTrack, onBack }: PlaylistViewProps) => {
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [orderedTrackIds, setOrderedTrackIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reorderMutation = useReorderPlaylistTracks();
  const removeTrackMutation = useRemoveTrackFromPlaylist();
  const updatePlaylistMutation = useUpdatePlaylist();
  const updatePlaylistVisibility = useUpdatePlaylistVisibility();
  const deletePlaylistMutation = useDeletePlaylist();
  const uploadImageMutation = useUploadPlaylistImage();
  const { toast } = useToast();

  // Fetch fresh data directly in this component
  const { data: playlists = [] } = usePlaylists();
  const { data: tracks = [] } = useTracks();
  
  // Find the current playlist from the fresh data
  const playlist = playlists.find(p => p.id === playlistId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!playlist) return null;

  const playlistTracks = tracks.filter(track => playlist.trackIds.includes(track.id))
    .sort((a, b) => {
      const aIndex = orderedTrackIds.length > 0 ? orderedTrackIds.indexOf(a.id) : playlist.trackIds.indexOf(a.id);
      const bIndex = orderedTrackIds.length > 0 ? orderedTrackIds.indexOf(b.id) : playlist.trackIds.indexOf(b.id);
      return aIndex - bIndex;
    });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = playlistTracks.findIndex(track => track.id === active.id);
    const newIndex = playlistTracks.findIndex(track => track.id === over.id);

    const newOrder = arrayMove(playlistTracks, oldIndex, newIndex);
    const newTrackIds = newOrder.map(track => track.id);
    
    // Optimistically update the UI
    setOrderedTrackIds(newTrackIds);

    try {
      await reorderMutation.mutateAsync({ 
        playlistId: playlist.id, 
        trackIds: newTrackIds 
      });
      
      toast({
        title: "Track order updated",
        description: "The playlist has been reordered.",
      });
    } catch (error) {
      // Revert on error
      setOrderedTrackIds([]);
      toast({
        title: "Error reordering tracks",
        description: "Could not update track order. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    try {
      await removeTrackMutation.mutateAsync({ 
        playlistId: playlist.id, 
        trackId 
      });
      
      toast({
        title: "Track removed",
        description: "Track has been removed from the playlist.",
      });
    } catch (error) {
      toast({
        title: "Error removing track",
        description: "Could not remove track. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRenamePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      await updatePlaylistMutation.mutateAsync({
        id: playlist.id,
        name: newPlaylistName.trim()
      });
      
      setShowRenameDialog(false);
      setNewPlaylistName("");
      
      toast({
        title: "Playlist renamed",
        description: `Playlist renamed to "${newPlaylistName.trim()}".`,
      });
    } catch (error) {
      toast({
        title: "Error renaming playlist",
        description: "Could not rename playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePlaylist = async () => {
    try {
      await deletePlaylistMutation.mutateAsync(playlist.id);
      
      toast({
        title: "Playlist deleted",
        description: `"${playlist.name}" has been deleted.`,
      });
      
      // Navigate back to library after deletion
      onBack();
    } catch (error) {
      toast({
        title: "Error deleting playlist",
        description: "Could not delete playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      await uploadImageMutation.mutateAsync({ file, playlistId: playlist.id });
      
      toast({
        title: "Image uploaded",
        description: "Playlist image has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error uploading image",
        description: "Could not upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrivacyChange = async (isPublic: boolean) => {
    try {
      await updatePlaylistVisibility.mutateAsync({
        playlistId: playlist.id,
        isPublic
      });
      
      toast({
        title: "Privacy updated",
        description: `Playlist is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update playlist privacy",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4 mr-2 text-primary" />
        <span className="text-primary">Back to Library</span>
      </Button>

      <div className="flex flex-col md:flex-row md:items-start space-y-6 md:space-y-0 md:space-x-6 mb-8">
        <div className="relative w-48 h-48 rounded-lg overflow-hidden group cursor-pointer border border-primary/20 flex-shrink-0 mx-auto md:mx-0" onClick={() => fileInputRef.current?.click()}>
          {playlist.imageUrl ? (
            <img 
              src={playlist.imageUrl} 
              alt={playlist.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
              <div className="text-6xl text-primary/60">♪</div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-center text-white">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-medium">Upload Image</p>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary">Playlist</Badge>
            <Badge variant={playlist.isPublic ? "default" : "secondary"} className="text-xs">
              {playlist.isPublic ? (
                <><Globe className="h-3 w-3 mr-1" />Public</>
              ) : (
                <><Lock className="h-3 w-3 mr-1" />Private</>
              )}
            </Badge>
            {playlist.sharedWith.length > 0 && (
              <Badge variant="outline" className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>Shared</span>
              </Badge>
            )}
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-primary break-words">{playlist.name}</h1>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-muted-foreground mb-6">
            <span>{playlistTracks.length} track{playlistTracks.length !== 1 ? 's' : ''}</span>
            <span className="hidden md:inline">•</span>
            <span>{calculatePlaylistDuration(playlistTracks)}</span>
            <span className="hidden md:inline">•</span>
            <span>Created {playlist.createdAt.toLocaleDateString()}</span>
            {playlist.sharedWith.length > 0 && (
              <>
                <span className="hidden md:inline">•</span>
                <span>Shared with {playlist.sharedWith.length} member{playlist.sharedWith.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* Privacy Controls */}
          <div className="mb-6">
            <Card className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <Label htmlFor="playlist-privacy" className="text-sm font-medium">
                    Make playlist public
                  </Label>
                  <p className="text-xs text-muted-foreground break-words">
                    {playlist.isPublic 
                      ? "Anyone can discover and listen to this playlist" 
                      : "Only you and shared members can access this playlist"
                    }
                  </p>
                </div>
                <Switch
                  id="playlist-privacy"
                  checked={playlist.isPublic || false}
                  onCheckedChange={handlePrivacyChange}
                  disabled={updatePlaylistVisibility.isPending}
                  className="flex-shrink-0"
                />
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button 
              size="lg" 
              disabled={playlistTracks.length === 0}
              onClick={() => playlistTracks.length > 0 && onPlayTrack(playlistTracks[0], playlistTracks)}
              className="flex-1 sm:flex-none"
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Play All
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setShowAddTracksModal(true)}
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-2 text-primary" />
              <span className="text-primary">Add Tracks</span>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setShowShareModal(true)}
              className="flex-1 sm:flex-none"
            >
              <Share2 className="w-4 h-4 mr-2 text-primary" />
              <span className="text-primary">Share</span>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="lg">
                  <MoreHorizontal className="w-5 h-5 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setNewPlaylistName(playlist.name);
                  setShowRenameDialog(true);
                }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Rename playlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Image className="w-4 h-4 mr-2" />
                  Change image
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete playlist
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete playlist?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{playlist.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeletePlaylist}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete playlist
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {playlistTracks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
            <div className="text-2xl text-primary/60">♪</div>
          </div>
          <h3 className="text-xl font-semibold mb-2 text-primary">This playlist is empty</h3>
          <p className="text-muted-foreground mb-4">Seed the silence with fragments of sound.</p>
          <Button variant="outline" className="border-2" onClick={() => setShowAddTracksModal(true)}>
            <Plus className="w-4 h-4 mr-2 text-primary" />
            <span className="text-primary">Add Tracks</span>
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={playlistTracks.map(track => track.id)}
              strategy={verticalListSortingStrategy}
            >
              {playlistTracks.map((track, index) => (
                <SortableTrackItem
                  key={track.id}
                  track={track}
                  index={index}
                  onPlay={onPlayTrack}
                  onRemove={handleRemoveTrack}
                  playlist={playlistTracks}
                  playlistImageUrl={playlist.imageUrl}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Card>
      )}

      <AddTracksModal
        open={showAddTracksModal}
        onOpenChange={setShowAddTracksModal}
        playlistId={playlist.id}
        playlistName={playlist.name}
        allTracks={tracks}
        existingTrackIds={playlist.trackIds}
      />

      {/* Rename Playlist Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename playlist</DialogTitle>
            <DialogDescription>
              Enter a new name for this playlist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="playlist-name">Playlist name</Label>
              <Input
                id="playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenamePlaylist();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRenameDialog(false)} className="text-primary">
              Cancel
            </Button>
            <Button 
              onClick={handleRenamePlaylist}
              disabled={!newPlaylistName.trim() || newPlaylistName.trim() === playlist.name}
            >
              Rename playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SharePlaylistModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        playlist={playlist}
      />
    </div>
  );
};

export default PlaylistView;
