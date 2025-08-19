// src/pages/PlaylistsPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import PlaylistsGrid from "@/components/PlaylistsGrid";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useTracks } from "@/hooks/useTracks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Track } from "@/types/music";

export const PlaylistsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: playlists = [] } = usePlaylists();
  const { data: tracks = [] } = useTracks();
  const { playPlaylist } = useAudioPlayer();

  const handlePlay = (playlist) => {
    // build an ordered Track[] from playlist.trackIds
    const ordered = playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t);
    playPlaylist(ordered, 0, {
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.imageUrl
    });
  };

  return (
    <PlaylistsGrid
      playlists={playlists}
      tracks={tracks}
      onPlayPlaylist={handlePlay}
      onPlaylistSelect={(pl) => navigate(`/playlists/${pl.id}`)}
    />
  );
};
