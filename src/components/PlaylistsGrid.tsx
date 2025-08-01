// src/components/PlaylistsGrid.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Playlist, Track, calculatePlaylistDuration } from "@/types/music";
import { usePlaylistCategories, usePlaylistCategoryLinks } from "@/hooks/usePlaylistCategories";

interface PlaylistsGridProps {
  playlists: Playlist[];
  tracks: Track[];
  /** Now takes full Playlist so parent can map its .trackIds in order */
  onPlayPlaylist: (playlist: Playlist) => void;
  onPlaylistSelect: (playlist: Playlist) => void;
}

interface PlaylistGroup {
  name: string;
  playlists: Playlist[];
}

const PlaylistsGrid: React.FC<PlaylistsGridProps> = ({
  playlists,
  tracks,
  onPlayPlaylist,
  onPlaylistSelect,
}) => {
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { data: categories = [] } = usePlaylistCategories();
  const { data: categoryLinks = [] } = usePlaylistCategoryLinks();

  // Group playlists by category
  const playlistGroups: PlaylistGroup[] = [
    ...categories
      .map((category) => ({
        name: category.name,
        playlists: playlists.filter((pl) =>
          categoryLinks.some(
            (link) =>
              link.playlist_id === pl.id &&
              link.playlist_categories?.name === category.name
          )
        ),
      }))
      .filter((g) => g.playlists.length > 0),
    {
      name: "Unsorted",
      playlists: playlists.filter(
        (pl) => !categoryLinks.some((link) => link.playlist_id === pl.id)
      ),
    },
  ].filter((g) => g.playlists.length > 0);

  const handlePlaylistClick = (playlist: Playlist) => {
    onPlaylistSelect(playlist);
  };

  // Now receives the entire Playlist
  const handlePlayAllClick = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    onPlayPlaylist(playlist);
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const shouldShowShowAll = (group: PlaylistGroup) => group.playlists.length > 6;

  const getVisiblePlaylists = (group: PlaylistGroup) => {
    const isExpanded = expandedGroups[group.name];
    return isExpanded ? group.playlists : group.playlists.slice(0, 6);
  };

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">No playlists yet</div>
          <div className="text-muted-foreground/60 text-sm">
            Create your first playlist to get started
          </div>
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
                  {playlist.imageUrl ? (
                    <img
                      src={playlist.imageUrl}
                      alt={playlist.name}
                      className="w-full h-full object-cover transition-all duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                      <div className="text-2xl font-bold text-muted-foreground/60">
                        {playlist.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}

                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                    <Button
                      size="icon"
                      variant="default"
                      className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-200 shadow-lg"
                      onClick={(e) => handlePlayAllClick(e, playlist)}
                    >
                      <Play className="w-5 h-5 fill-current" />
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
                      <span>
                        {" "}
                        •{" "}
                        {calculatePlaylistDuration(
                          tracks.filter((t) => playlist.trackIds.includes(t.id))
                        )}
                      </span>
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
