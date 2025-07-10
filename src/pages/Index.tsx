
import { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MusicLibrary from "@/components/MusicLibrary";
import PlaylistView from "@/components/PlaylistView";
import Player from "@/components/Player";
import FullScreenPlayer from "@/components/FullScreenPlayer";
import { Track, Playlist } from "@/types/music";
import { useTracks } from "@/hooks/useTracks";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

const Index = () => {
  const [currentView, setCurrentView] = useState<"library" | "playlist">("library");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);

  // Fetch real data from Supabase
  const { data: tracks = [], isLoading: tracksLoading, error: tracksError } = useTracks();
  const { data: playlists = [], isLoading: playlistsLoading, error: playlistsError } = usePlaylists();
  
  // Audio player functionality
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioRef,
    isShuffleMode,
    isRepeatMode,
    playTrack,
    playPlaylist,
    togglePlayPause,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    seekTo,
    setVolume,
    formatTime
  } = useAudioPlayer();

  const handlePlayTrack = (track: Track, playlist?: Track[]) => {
    if (playlist) {
      // Play as playlist starting from the selected track
      const startIndex = playlist.findIndex(t => t.id === track.id);
      playPlaylist(playlist, startIndex !== -1 ? startIndex : 0);
    } else {
      // If it's the same track, toggle play/pause
      if (currentTrack?.id === track.id) {
        togglePlayPause();
      } else {
        // If it's a different track, play the new track
        playTrack(track);
      }
    }
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
      <audio ref={audioRef} />
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
              currentTrack={currentTrack}
              isPlaying={isPlaying}
            />
          ) : (
            <PlaylistView 
              playlistId={selectedPlaylist?.id || ""}
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
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isShuffleMode={isShuffleMode}
          isRepeatMode={isRepeatMode}
          onPlayPause={togglePlayPause}
          onSeek={seekTo}
          onVolumeChange={setVolume}
          onNext={playNext}
          onPrevious={playPrevious}
          onShuffle={toggleShuffle}
          onRepeat={toggleRepeat}
          onFullScreen={() => setShowFullScreen(true)}
          formatTime={formatTime}
        />
      )}

      {showFullScreen && currentTrack && (
        <FullScreenPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          audioRef={audioRef}
          onClose={() => setShowFullScreen(false)}
          onTogglePlayPause={togglePlayPause}
          onSeek={seekTo}
          formatTime={formatTime}
        />
      )}
    </div>
  );
};

export default Index;
