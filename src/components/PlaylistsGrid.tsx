import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaylistThumbnail } from "@/components/PlaylistThumbnail";
import { Playlist, Track, calculatePlaylistDuration } from "@/types/music";
import { usePlaylistCategories, usePlaylistCategoryLinks } from "@/hooks/usePlaylistCategories";

interface PlaylistsGridProps {
  playlists: Playlist[];
  tracks: Track[];
  onPlayPlaylist: (playlistId: string) => void;
  onPlaylistSelect: (playlist: Playlist) => void;
}

interface PlaylistGroup {
  name: string;
  playlists: Playlist[];
}

const PlaylistsGrid = ({ playlists, tracks, onPlayPlaylist, onPlaylistSelect }: PlaylistsGridProps) => {
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const { data: categories = [] } = usePlaylistCategories();
  const { data: categoryLinks = [] } = usePlaylistCategoryLinks();

  // Group playlists by category
  const playlistGroups: PlaylistGroup[] = [
    // Categorized playlists
    ...categories.map(category => ({
      name: category.name,
      playlists: playlists.filter(playlist => 
        categoryLinks.some(link => 
          link.playlist_id === playlist.id && 
          link.playlist_categories?.name === category.name
        )
      )
    })).filter(group => group.playlists.length > 0),
    
    // Uncategorized playlists
    {
      name: "Unsorted",
      playlists: playlists.filter(playlist => 
        !categoryLinks.some(link => link.playlist_id === playlist.id)
      )
    }
  ].filter(group => group.playlists.length > 0);

  const handlePlaylistClick = (playlist: Playlist) => {
    onPlaylistSelect(playlist);
  };

  const handlePlayAllClick = (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onPlayPlaylist(playlistId);
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const shouldShowShowAll = (group: PlaylistGroup) => {
    return group.playlists.length > 6;
  };

  const getVisiblePlaylists = (group: PlaylistGroup) => {
    const isExpanded = expandedGroups[group.name];
    return isExpanded ? group.playlists : group.playlists.slice(0, 6);
  };

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">No playlists yet</div>
          <div className="text-muted-foreground/60 text-sm">Create your first playlist to get started</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {playlistGroups.map((group) => (
        <div key={group.name} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">{group.name}</h2>
            {shouldShowShowAll(group) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleGroupExpansion(group.name)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expandedGroups[group.name] ? "Show less" : "Show all"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {getVisiblePlaylists(group).map((playlist) => (
              <div
                key={playlist.id}
                className="group cursor-pointer space-y-2"
                onClick={() => handlePlaylistClick(playlist)}
              >
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                  <PlaylistThumbnail
                    imageUrl={playlist.imageUrl}
                    name={playlist.name}
                    className="transition-transform duration-200 group-hover:scale-105"
                    priority={false}
                    size="md"
                  />
                  
                  {/* Play button overlay - positioned in bottom right corner to avoid scroll interference */}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      size="icon"
                      variant="default"
                      className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform duration-200"
                      onClick={(e) => handlePlayAllClick(e, playlist.id)}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {playlist.name}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    {playlist.trackIds?.length || 0} tracks
                    {playlist.trackIds && playlist.trackIds.length > 0 && (
                      <span> • {calculatePlaylistDuration(tracks.filter(track => playlist.trackIds.includes(track.id)))}</span>
                    )}
                  </div>
                  {playlist.isPublic && (
                    <div className="text-xs text-muted-foreground/60">Public</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlaylistsGrid;