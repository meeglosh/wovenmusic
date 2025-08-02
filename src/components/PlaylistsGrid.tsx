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
  onPlayPlaylist: (playlistId: string) => void;
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { data: categories = [] } = usePlaylistCategories();
  const { data: categoryLinks = [] } = usePlaylistCategoryLinks();

  // Group by category + “Unsorted”
  const playlistGroups: PlaylistGroup[] = [
    ...categories
      .map(cat => ({
        name: cat.name,
        playlists: playlists.filter(pl =>
          categoryLinks.some(
            link =>
              link.playlist_id === pl.id &&
              link.playlist_categories?.name === cat.name
          )
        ),
      }))
      .filter(g => g.playlists.length > 0),
    {
      name: "Unsorted",
      playlists: playlists.filter(
        pl => !categoryLinks.some(link => link.playlist_id === pl.id)
      ),
    },
  ].filter(g => g.playlists.length > 0);

  const toggleGroup = (name: string) =>
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));

  if (!playlists.length) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg text-muted-foreground mb-2">No playlists yet</p>
        <p className="text-sm text-muted-foreground/60">
          Create your first playlist to get started
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {playlistGroups.map(group => {
        const isExpanded = !!expandedGroups[group.name];
        const shown = isExpanded ? group.playlists : group.playlists.slice(0, 6);
        return (
          <div key={group.name} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{group.name}</h2>
              {group.playlists.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroup(group.name)}
                >
                  {isExpanded ? "Show less" : "Show all"}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {shown.map(pl => (
                <div
                  key={pl.id}
                  className="group cursor-pointer space-y-2"
                  onClick={() => onPlaylistSelect(pl)}
                >
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    {pl.imageUrl ? (
                      <img
                        src={pl.imageUrl}
                        alt={pl.name}
                        className="w-full h-full object-cover transition-all duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                        <span className="text-2xl font-bold text-muted-foreground/60">
                          {pl.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Play button */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all duration-200">
                      <Button
                        size="icon"
                        variant="default"
                        className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-200 shadow-lg"
                        onClick={e => {
                          e.stopPropagation();
                          onPlayPlaylist(pl.id);
                        }}
                      >
                        <Play className="w-5 h-5 fill-current" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {pl.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {pl.trackIds?.length ?? 0} tracks
                      {pl.trackIds?.length ? (
                        <> • {calculatePlaylistDuration(tracks.filter(t => pl.trackIds.includes(t.id)))}</>
                      ) : null}
                    </p>
                    {pl.isPublic && (
                      <p className="text-xs text-muted-foreground/60">Public</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlaylistsGrid;
