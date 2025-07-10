
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Share2, Users, MoreHorizontal, Plus, GripVertical, Trash2 } from "lucide-react";
import { Track, Playlist } from "@/types/music";
import AddTracksModal from "./AddTracksModal";
import { useReorderPlaylistTracks, useRemoveTrackFromPlaylist } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/use-toast";
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
}

const SortableTrackItem = ({ track, index, onPlay, onRemove, playlist }: SortableTrackItemProps) => {
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
      className="grid grid-cols-[auto,auto,1fr,auto,auto] gap-4 p-4 hover:bg-muted/30 transition-colors group border-b border-border last:border-b-0"
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="w-6 flex items-center cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Track Number / Play Button */}
      <div className="w-12 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onPlay(track, playlist)}
        >
          <Play className="w-4 h-4 fill-current" />
        </Button>
        <span className="text-muted-foreground text-sm group-hover:opacity-0 transition-opacity">
          {index + 1}
        </span>
      </div>

      {/* Track Info */}
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
          <p className="font-medium">{track.title}</p>
          <p className="text-sm text-muted-foreground">{track.artist}</p>
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center text-muted-foreground">
        {track.duration}
      </div>

      {/* Actions */}
      <div className="w-12 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onRemove(track.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const PlaylistView = ({ playlistId, onPlayTrack, onBack }: PlaylistViewProps) => {
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [orderedTrackIds, setOrderedTrackIds] = useState<string[]>([]);
  const reorderMutation = useReorderPlaylistTracks();
  const removeTrackMutation = useRemoveTrackFromPlaylist();
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

  return (
    <div className="p-6">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Library
      </Button>

      <div className="flex items-start space-x-6 mb-8">
        <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center border border-primary/20">
          <div className="text-6xl text-primary/60">♪</div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <Badge variant="secondary">Playlist</Badge>
            {playlist.sharedWith.length > 0 && (
              <Badge variant="outline" className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>Shared</span>
              </Badge>
            )}
          </div>
          
          <h1 className="text-5xl font-bold mb-4">{playlist.name}</h1>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-6">
            <span>{playlistTracks.length} track{playlistTracks.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>Created {playlist.createdAt.toLocaleDateString()}</span>
            {playlist.sharedWith.length > 0 && (
              <>
                <span>•</span>
                <span>Shared with {playlist.sharedWith.length} member{playlist.sharedWith.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              size="lg" 
              className="rounded-full"
              disabled={playlistTracks.length === 0}
              onClick={() => playlistTracks.length > 0 && onPlayTrack(playlistTracks[0], playlistTracks)}
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Play All
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setShowAddTracksModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tracks
            </Button>
            <Button variant="outline" size="lg">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="lg">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {playlistTracks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
            <div className="text-2xl text-primary/60">♪</div>
          </div>
          <h3 className="text-xl font-semibold mb-2">This playlist is empty</h3>
          <p className="text-muted-foreground mb-4">Add some tracks to get started.</p>
          <Button variant="outline" onClick={() => setShowAddTracksModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Tracks
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
    </div>
  );
};

export default PlaylistView;
