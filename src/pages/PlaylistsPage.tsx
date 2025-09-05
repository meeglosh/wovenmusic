// src/pages/PlaylistsPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PlaylistsGrid from "@/components/PlaylistsGrid";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useTracks } from "@/hooks/useTracks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { R2DiagnosticsTest } from "@/components/R2DiagnosticsTest";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Settings } from "lucide-react";
import type { Track } from "@/types/music";

export const PlaylistsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: playlists = [] } = usePlaylists();
  const { data: tracks = [] } = useTracks();
  const { playPlaylist } = useAudioPlayer();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
    <div className="space-y-6">
      <PlaylistsGrid
        playlists={playlists}
        tracks={tracks}
        onPlayPlaylist={handlePlay}
        onPlaylistSelect={(pl) => navigate(`/playlists/${pl.id}`)}
      />

      <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            R2 Storage Diagnostics
            <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showDiagnostics ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <R2DiagnosticsTest />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
