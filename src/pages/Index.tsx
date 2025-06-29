
import { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MusicLibrary from "@/components/MusicLibrary";
import PlaylistView from "@/components/PlaylistView";
import Player from "@/components/Player";
import { Track, Playlist } from "@/types/music";
import { useTracks } from "@/hooks/useTracks";
import { usePlaylists } from "@/hooks/usePlaylists";

const Index = () => {
  const [currentView, setCurrentView] = useState<"library" | "playlist">("library");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch real data from Supabase
  const { data: tracks = [], isLoading: tracksLoading, error: tracksError } = useTracks();
  const { data: playlists = [], isLoading: playlistsLoading, error: playlistsError } = usePlaylists();

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleViewPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView("playlist");
  };

  // Show loading state
  if (tracksLoading || playlistsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <p className="text-muted-foreground">Loading your music...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (tracksError || playlistsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">!</span>
          </div>
          <p className="text-muted-foreground">Error loading data. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          playlists={playlists}
          currentView={currentView}
          onViewChange={setCurrentView}
          onPlaylistSelect={handleViewPlaylist}
        />
        
        <main className="flex-1 overflow-auto">
          {currentView === "library" ? (
            <MusicLibrary 
              tracks={tracks} 
              onPlayTrack={handlePlayTrack}
            />
          ) : (
            <PlaylistView 
              playlist={selectedPlaylist}
              tracks={tracks}
              onPlayTrack={handlePlayTrack}
              onBack={() => setCurrentView("library")}
            />
          )}
        </main>
      </div>

      {currentTrack && (
        <Player 
          track={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying(!isPlaying)}
        />
      )}
    </div>
  );
};

export default Index;
