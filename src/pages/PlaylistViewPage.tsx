// src/pages/PlaylistViewPage.tsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlaylistView from "@/components/PlaylistView";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Track } from "@/types/music";

export const PlaylistViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playPlaylist } = useAudioPlayer();

  return (
    <PlaylistView
      playlistId={id!}
      onPlayTrack={(_track: Track, playlistTracks?: Track[]) => {
        if (!playlistTracks) return;
        // Note: This might not have playlist context since it's called from track selection
        // The calling component would need to be updated to pass playlist info
        playPlaylist(playlistTracks, 0);
      }}
      onBack={() => navigate(-1)}
    />
  );
};
