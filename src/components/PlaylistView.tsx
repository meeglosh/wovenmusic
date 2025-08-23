
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Share2, Users, Plus, GripVertical, Trash2, Edit, X, Upload, Image, Lock, Globe, Pencil } from "lucide-react";
import { Track, Playlist, getCleanTitle, calculatePlaylistDuration } from "@/types/music";
import AddTracksModal from "./AddTracksModal";
import SharePlaylistModal from "./SharePlaylistModal";
import { useReorderPlaylistTracks, useRemoveTrackFromPlaylist, useUpdatePlaylist, useDeletePlaylist, useUploadPlaylistImage, useDeletePlaylistImage, usePlaylists } from "@/hooks/usePlaylists";
import { useUpdatePlaylistVisibility } from "@/hooks/usePlaylistSharing";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlaylistCategories, useGetPlaylistCategories, useAssignPlaylistCategory, useRemovePlaylistCategory, useCreatePlaylistCategory } from "@/hooks/usePlaylistCategories";
import { useTracks } from "@/hooks/useTracks";
import { usePermissions } from "@/hooks/usePermissions";
import { PlaylistComments } from "@/components/PlaylistComments";
import { OfflineDownloadToggle } from "@/components/OfflineDownloadToggle";
import OptimizedImage from "@/components/OptimizedImage";
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


// Sortable Track Item Component
interface SortableTrackItemProps {
  track: Track;
  index: number;
  onPlay: (track: Track, playlist?: Track[]) => void;
  onRemove: (trackId: string) => void;
  playlist: Track[];
  playlistImageUrl?: string;
  canManagePlaylistTracks: boolean;
}

const SortableTrackItem = ({ track, index, onPlay, onRemove, playlist, playlistImageUrl, canManagePlaylistTracks }: SortableTrackItemProps) => {
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
        {...(canManagePlaylistTracks ? { ...attributes, ...listeners } : {})}
        className={`w-6 flex items-center ${canManagePlaylistTracks ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {canManagePlaylistTracks && (
          <GripVertical className="w-4 h-4 text-muted-foreground opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity" />
        )}
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
            <OptimizedImage
              src={playlistImageUrl} 
              alt="Track thumbnail" 
              className="w-full h-full"
              sizes="40px"
              objectFit="cover"
              loading="lazy"
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
        {canManagePlaylistTracks ? (
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
        ) : null}
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPlaylistName, setEditPlaylistName] = useState("");
  const [selectedEditCategoryId, setSelectedEditCategoryId] = useState<string>("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const reorderMutation = useReorderPlaylistTracks();
  const removeTrackMutation = useRemoveTrackFromPlaylist();
  const updatePlaylistMutation = useUpdatePlaylist();
  const updatePlaylistVisibility = useUpdatePlaylistVisibility();
  const deletePlaylistMutation = useDeletePlaylist();
  const uploadImageMutation = useUploadPlaylistImage();
  const deleteImageMutation = useDeletePlaylistImage();
  const { toast } = useToast();
  const { canEditPlaylist, canDeletePlaylist, canManagePlaylistTracks, canEditPlaylistPrivacy, canSharePlaylist } = usePermissions();
  
  // Category hooks
  const { data: categories = [] } = usePlaylistCategories();
  const { data: playlistCategories = [] } = useGetPlaylistCategories(playlistId);
  const assignCategoryMutation = useAssignPlaylistCategory();
  const removeCategoryMutation = useRemovePlaylistCategory();
  const createCategoryMutation = useCreatePlaylistCategory();

  // Fetch fresh data directly in this component
  const { data: playlists = [] } = usePlaylists();
  const { data: tracks = [] } = useTracks();
  
  // Find the current playlist from the fresh data
  const playlist = playlists.find(p => p.id === playlistId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { distance: 8 }
    }),
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
      
      toast({
        title: "Playlist updated",
        description: `Playlist renamed to "${newPlaylistName.trim()}".`,
      });
    } catch (error) {
      toast({
        title: "Error updating playlist",
        description: "Could not update playlist. Please try again.",
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

  const handleDeleteImage = async () => {
    try {
      await deleteImageMutation.mutateAsync(playlist.id);
      
      toast({
        title: "Image deleted",
        description: "Playlist image has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error deleting image",
        description: "Could not delete image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditPlaylistSubmit = async () => {
    if (!editPlaylistName.trim()) return;
    
    try {
      await updatePlaylistMutation.mutateAsync({
        id: playlist.id,
        name: editPlaylistName.trim()
      });
      
      toast({
        title: "Playlist updated",
        description: `Playlist renamed to "${editPlaylistName.trim()}".`,
      });
      
      setShowEditDialog(false);
    } catch (error) {
      toast({
        title: "Error updating playlist",
        description: "Could not update playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleCategoryChange = async (categoryId: string) => {
    console.log('handleCategoryChange called with:', { categoryId, type: typeof categoryId });
    
    if (!categoryId || categoryId === 'none') {
      // Remove all categories if "No category" is selected
      console.log('Removing categories for playlist:', playlist.id, 'Current categories:', playlistCategories);
      for (const category of playlistCategories) {
        try {
          await removeCategoryMutation.mutateAsync({
            playlistId: playlist.id,
            categoryId: category.id
          });
        } catch (error) {
          console.error("Error removing category:", error);
        }
      }
      toast({
        title: "Category removed",
        description: "Playlist category has been cleared.",
      });
    } else {
      try {
        // Remove existing categories first (since we only allow one category)
        for (const category of playlistCategories) {
          await removeCategoryMutation.mutateAsync({
            playlistId: playlist.id,
            categoryId: category.id
          });
        }
        
        // Add the new category
        await assignCategoryMutation.mutateAsync({
          playlistId: playlist.id,
          categoryId
        });
        
        const selectedCategory = categories.find(c => c.id === categoryId);
        toast({
          title: "Category updated",
          description: `Playlist categorized as "${selectedCategory?.name}".`,
        });
      } catch (error) {
        toast({
          title: "Error updating category",
          description: "Could not update playlist category. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const newCategory = await createCategoryMutation.mutateAsync({
        name: newCategoryName.trim()
      });
      
      // Auto-assign the new category to this playlist
      await assignCategoryMutation.mutateAsync({
        playlistId: playlist.id,
        categoryId: newCategory.id
      });
      
      // Update UI state
      setSelectedEditCategoryId(newCategory.id);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      
      toast({
        title: "Category created",
        description: `"${newCategory.name}" category created and assigned.`,
      });
    } catch (error) {
      toast({
        title: "Error creating category",
        description: "Could not create category. Please try again.",
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
            <OptimizedImage
              src={playlist.imageUrl} 
              alt={playlist.name} 
              className="w-full h-full"
              sizes="192px"
              objectFit="cover"
              priority={true}
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
            <Badge variant={playlist.isPublic ? "default" : "secondary"} className="text-xs">
              {playlist.isPublic ? (
                <><Globe className="h-3 w-3 mr-1" />Public Playlist</>
              ) : (
                <><Lock className="h-3 w-3 mr-1" />Private Playlist</>
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
            <span>Created by {playlist.createdByName} – {playlist.createdAt.toLocaleDateString()}</span>
            {playlist.sharedWith.length > 0 && (
              <>
                <span className="hidden md:inline">•</span>
                <span>Shared with {playlist.sharedWith.length} member{playlist.sharedWith.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* Category Selection */}
          {canEditPlaylist(playlist) && categories.length > 0 && (
            <div className="mb-6">
              <Card className="p-4">
                <div className="space-y-3">
                  <Label htmlFor="playlist-category" className="text-sm font-medium">
                    Category
                  </Label>
                   <Select 
                     value={playlistCategories[0]?.id || "none"} 
                     onValueChange={(value) => {
                       console.log('Category changed in main view:', { value, currentCategories: playlistCategories });
                       handleCategoryChange(value);
                     }}
                     disabled={assignCategoryMutation.isPending || removeCategoryMutation.isPending}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select a category" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">No category</SelectItem>
                       {categories.filter(category => category.id && category.id.trim() && typeof category.id === 'string').map((category) => (
                         <SelectItem key={category.id} value={category.id}>
                           {category.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                </div>
              </Card>
            </div>
          )}

          {/* Privacy and Download Controls */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Privacy Controls */}
            {canEditPlaylistPrivacy(playlist) && (
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
                    onCheckedChange={canEditPlaylistPrivacy(playlist) ? handlePrivacyChange : () => {
                      toast({
                        title: "Permission denied",
                        description: "You don't have permission to change privacy settings for this playlist.",
                        variant: "destructive",
                      });
                    }}
                    disabled={updatePlaylistVisibility.isPending || !canEditPlaylistPrivacy(playlist)}
                    className="flex-shrink-0"
                  />
                </div>
              </Card>
            )}

            {/* Offline Download Controls */}
            <OfflineDownloadToggle 
              playlist={playlist}
              tracks={playlistTracks}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3">
            <Button 
              size="lg" 
              disabled={playlistTracks.length === 0}
              onClick={() => playlistTracks.length > 0 && onPlayTrack(playlistTracks[0], playlistTracks)}
              className="w-full max-w-[343px] sm:flex-none sm:w-auto sm:max-w-none min-h-[44px] sm:min-h-0"
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Play All
            </Button>
            {canManagePlaylistTracks(playlist) && (
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowAddTracksModal(true)}
                className="w-full max-w-[343px] sm:flex-none sm:w-auto sm:max-w-none min-h-[44px] sm:min-h-0"
              >
                <Plus className="w-4 h-4 mr-2 text-primary" />
                <span className="text-primary">Add Tracks</span>
              </Button>
            )}
            {canSharePlaylist(playlist) && (
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowShareModal(true)}
                className="w-full max-w-[343px] sm:flex-none sm:w-auto sm:max-w-none min-h-[44px] sm:min-h-0"
              >
                <Share2 className="w-4 h-4 mr-2 text-primary" />
                <span className="text-primary">Share</span>
              </Button>
            )}
            
            {/* Edit Icon */}
            {canEditPlaylist(playlist) && (
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => {
                  setNewPlaylistName(playlist.name);
                  setShowEditDialog(true);
                }}
                className="w-full max-w-[343px] sm:flex-none sm:w-auto sm:max-w-none min-h-[44px] sm:min-h-0"
                title="Edit playlist"
              >
                <Pencil className="w-4 h-4 mr-2 text-primary" />
                <span className="text-primary">Edit</span>
              </Button>
            )}
            
            {/* Delete Icon */}
            {canDeletePlaylist(playlist) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full max-w-[343px] sm:flex-none sm:w-auto sm:max-w-none min-h-[44px] sm:min-h-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Delete</span>
                  </Button>
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
            )}
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
                  canManagePlaylistTracks={canManagePlaylistTracks(playlist)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Card>
      )}

      {/* Comments Section */}
      <PlaylistComments 
        playlistId={playlistId}
        playlistName={playlist.name}
      />

      <AddTracksModal
        open={showAddTracksModal}
        onOpenChange={setShowAddTracksModal}
        playlistId={playlist.id}
        playlistName={playlist.name}
        allTracks={tracks}
        existingTrackIds={playlist.trackIds}
      />

      {/* Rename Playlist Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={(open) => {
        setShowRenameDialog(open);
        if (!open) {
          // Force cleanup of any lingering DOM state
          setTimeout(() => {
            document.body.style.overflow = '';
            document.body.style.pointerEvents = '';
            document.body.removeAttribute('inert');
            
            // Remove any lingering Radix overlays
            const overlays = document.querySelectorAll('[data-radix-portal]');
            overlays.forEach(overlay => {
              if (overlay.children.length === 0) {
                overlay.remove();
              }
            });
          }, 50);
        }
      }}>
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

      {/* Edit Playlist Details Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setShowNewCategoryInput(false);
          setNewCategoryName("");
          // Force cleanup of any lingering DOM state
          setTimeout(() => {
            document.body.style.overflow = '';
            document.body.style.pointerEvents = '';
            document.body.removeAttribute('inert');
            
            // Remove any lingering Radix overlays
            const overlays = document.querySelectorAll('[data-radix-portal]');
            overlays.forEach(overlay => {
              if (overlay.children.length === 0) {
                overlay.remove();
              }
            });
          }, 50);
        } else {
          // Pre-fill with current values when opening
          setEditPlaylistName(playlist.name);
          const currentCategoryId = playlistCategories.length > 0 ? playlistCategories[0].id : "none";
          console.log('Setting selectedEditCategoryId on dialog open:', { currentCategoryId, playlistCategories });
          setSelectedEditCategoryId(currentCategoryId);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit playlist details</DialogTitle>
            <DialogDescription>
              Update your playlist name, image, and category.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Rename Section */}
            <div className="space-y-2">
              <Label htmlFor="edit-playlist-name">Playlist name</Label>
              <Input
                id="edit-playlist-name"
                value={editPlaylistName}
                onChange={(e) => setEditPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editPlaylistName.trim()) {
                    handleEditPlaylistSubmit();
                  }
                }}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {editPlaylistName.length}/100 characters
              </p>
            </div>

            {/* Image Management Section */}
            <div className="space-y-3">
              <Label>Playlist image</Label>
              <div className="flex items-start gap-4">
                 <div className="w-20 h-20 rounded-lg overflow-hidden border border-border flex-shrink-0">
                  {playlist.imageUrl ? (
                    <OptimizedImage
                      src={playlist.imageUrl} 
                      alt={playlist.name} 
                      className="w-full h-full"
                      sizes="80px"
                      objectFit="cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                      <div className="text-xl text-primary/60">♪</div>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editImageInputRef.current?.click()}
                    disabled={uploadImageMutation.isPending}
                    className="w-full justify-start"
                  >
                    <Image className="w-4 h-4 mr-2" />
                    {playlist.imageUrl ? "Change image" : "Upload image"}
                  </Button>
                  {playlist.imageUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteImage}
                      disabled={deleteImageMutation.isPending}
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={editImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditImageUpload}
                className="hidden"
              />
            </div>

            {/* Category Section */}
            <div className="space-y-2">
              <Label htmlFor="edit-playlist-category">Category</Label>
              {categories.length > 0 || canEditPlaylist(playlist) ? (
                <div className="space-y-2">
                  {categories.length > 0 && (
                    <>
                       <Select 
                         value={selectedEditCategoryId || "none"} 
                         onValueChange={(value) => {
                           console.log('Category changed in edit dialog:', { value, previousValue: selectedEditCategoryId });
                           setSelectedEditCategoryId(value);
                           if (value !== selectedEditCategoryId) {
                             handleCategoryChange(value);
                           }
                         }}
                         disabled={assignCategoryMutation.isPending || removeCategoryMutation.isPending}
                       >
                         <SelectTrigger className="border-border">
                           <SelectValue placeholder="Select a category" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="none">No category</SelectItem>
                           {categories.filter(category => category.id && category.id.trim() && typeof category.id === 'string').map((category) => (
                             <SelectItem key={category.id} value={category.id}>
                               {category.name}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                      {(assignCategoryMutation.isPending || removeCategoryMutation.isPending) && (
                        <p className="text-xs text-muted-foreground">Updating category...</p>
                      )}
                    </>
                  )}
                  
                  {/* Admin Category Creation */}
                  {canEditPlaylist(playlist) && (
                    <div className="space-y-2">
                      {categories.length === 0 && (
                        <p className="text-sm text-muted-foreground mb-2">No categories available.</p>
                      )}
                       {!showNewCategoryInput ? (
                         <Button
                           type="button"
                           variant="default"
                           size="sm"
                           onClick={() => setShowNewCategoryInput(true)}
                           className="w-full justify-start"
                         >
                           <Plus className="w-4 h-4 mr-2" />
                           Create new category
                         </Button>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Enter category name"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newCategoryName.trim()) {
                                handleCreateCategory();
                              } else if (e.key === 'Escape') {
                                setShowNewCategoryInput(false);
                                setNewCategoryName("");
                              }
                            }}
                            maxLength={50}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleCreateCategory}
                              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                              className="flex-1"
                            >
                              {createCategoryMutation.isPending ? "Creating..." : "Create"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowNewCategoryInput(false);
                                setNewCategoryName("");
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No categories available. Contact an admin to create categories.</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowEditDialog(false)} 
              className="text-primary"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditPlaylistSubmit}
              disabled={!editPlaylistName.trim() || editPlaylistName.trim() === playlist.name || updatePlaylistMutation.isPending}
            >
              {updatePlaylistMutation.isPending ? "Saving..." : "Save changes"}
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
