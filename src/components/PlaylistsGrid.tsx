// src/components/PlaylistsGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Playlist, Track, calculatePlaylistDuration } from "@/types/music";
import {
  usePlaylistCategories,
  usePlaylistCategoryLinks,
} from "@/hooks/usePlaylistCategories";

interface PlaylistsGridProps {
  playlists: Playlist[];
  tracks: Track[];
  /** now hands back the playlist’s ID, so parent can look up its tracks in order */
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const { data: categories = [] } = usePlaylistCategories();
  const { data: categoryLinks = [] } = usePlaylistCategoryLinks();

  // group playlists by category + “Unsorted”
  const playlistGroups: PlaylistGroup[] = [
    ...categories
      .map((c) => ({
        name: c.name,
        playlists: playlists.filter((p) =>
          categoryLinks.some(
            (l) =>
              l.playlist_id === p.id &&
              l.playlist_categories?.name === c.name
          )
        ),
      }))
      .filter((g) => g.playlists.length),
    {
      name: "Unsorted",
      playlists: playlists.filter(
        (p) => !categoryLinks.some((l) => l.playlist_id === p.id)
      ),
    },
  ].filter((g) => g.playlists.length);

  const handlePlaylistClick = (pl: Playlist) => onPlaylistSelect(pl);

  const handlePlayAllClick = (
    e: React.MouseEvent,
    pl: Playlist
  ) => {
    e.stopPropagation();
    onPlayPlaylist(pl.id);
  };

  const toggleGroup = (name: string) =>
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  const shouldShowAll = (g: PlaylistGroup) => g.playlists.length > 6;
  const visible = (g: PlaylistGroup) =>
    expandedGroups[g.name] ? g.playlists : g.playlists.slice(0, 6);

  if (!playlists.length)
    return (
      <div className="p-6 text-center text-muted-foreground">
        <div className="py-12 text-lg">No playlists yet</div>
        <div className="text-sm">Create your first playlist to get started</div>
      </div>
    );

  return (
    <div className="p-6 space-y-8">
      {playlistGroups.map((group) => (
        <div key={group.name} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{group.name}</h2>
            {shouldShowAll(group) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleGroup(group.name)}
              >
                {expandedGroups[group.name] ? "Show less" : "Show all"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visible(group).map((pl) => (
              <div
                key={pl.id}
                className="group cursor-pointer space-y-2"
                onClick={() => handlePlaylistClick(pl)}
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  {pl.imageUrl ? (
                    <img
                      src={pl.imageUrl}
                      alt={pl.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-600/20">
                      <span className="text-2xl font-bold text-muted-foreground/60">
                        {pl.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
                    <Button
                      size="icon"
                      variant="default"
                      className="w-12 h-12 rounded-full bg-primary opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-shadow"
                      onClick={(e) => handlePlayAllClick(e, pl)}
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {pl.name}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    {pl.trackIds?.length || 0} tracks
                    {pl.trackIds?.length > 0 && (
                      <> • {calculatePlaylistDuration(tracks.filter(t => pl.trackIds!.includes(t.id)))}</>
                    )}
                  </div>
                  {pl.isPublic && (
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
