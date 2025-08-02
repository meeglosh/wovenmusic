// src/pages/PlaylistViewPage.tsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlaylistView from "@/components/PlaylistView";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Track } from "@/types/music";

export const PlaylistViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startPlaylistInOrder } = useAudioPlayer();

  return (
    <PlaylistView
      playlistId={id!}
      onPlayTrack={(_track: Track, playlistTracks?: Track[]) => {
        if (!playlistTracks) return;
        startPlaylistInOrder(playlistTracks);
      }}
      onBack={() => navigate(-1)}
    />
  );
};
