
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MusicLibrary from "@/components/MusicLibrary";
import PlaylistView from "@/components/PlaylistView";
import Player from "@/components/Player";
import FullScreenPlayer from "@/components/FullScreenPlayer";
import EmptyLibraryState from "@/components/EmptyLibraryState";

import { Track, Playlist, PendingTrack } from "@/types/music";
import { useTracks } from "@/hooks/useTracks";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasRedirected = useRef(false);

  // Handle playlist share token in URL - MUST be before any early returns
  const playlistToken = searchParams.get('playlist');
  
  // Redirect to public playlist page if playlist token is present
  useEffect(() => {
    if (playlistToken && !hasRedirected.current) {
      hasRedirected.current = true;
      // Navigate to the PublicPlaylist component with the token as a query param
      navigate(`/playlist/shared?token=${playlistToken}`, { replace: true });
    }
  }, [playlistToken, navigate]); // Include dependencies to prevent stale closures

  // State management
  const [currentView, setCurrentView] = useState<"library" | "playlist">("library");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentLibraryTitle, setCurrentLibraryTitle] = useState("Driftspace");
  const [showDropboxDialog, setShowDropboxDialog] = useState(false);
  const [showDropboxAccordion, setShowDropboxAccordion] = useState(() => {
    const saved = localStorage.getItem('showDropboxAccordion');
    return saved ? JSON.parse(saved) : false;
  });
  const [lastDialogTime, setLastDialogTime] = useState(0);
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);

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

  // Search functionality
  const filteredTracks = useMemo(() => {
    if (!searchTerm.trim()) return tracks;
    
    const searchLower = searchTerm.toLowerCase();
    return tracks.filter(track => 
      track.title.toLowerCase().includes(searchLower) ||
      track.artist.toLowerCase().includes(searchLower) ||
      (track.dropbox_path && track.dropbox_path.toLowerCase().includes(searchLower))
    );
  }, [tracks, searchTerm]);

  const filteredPlaylists = useMemo(() => {
    if (!searchTerm.trim()) return playlists;
    
    const searchLower = searchTerm.toLowerCase();
    return playlists.filter(playlist => 
      playlist.name.toLowerCase().includes(searchLower)
    );
  }, [playlists, searchTerm]);

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
        // If it's a different track, play it as part of the filtered tracks
        const startIndex = filteredTracks.findIndex(t => t.id === track.id);
        playPlaylist(filteredTracks, startIndex !== -1 ? startIndex : 0);
      }
    }
  };

  const handleViewPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView("playlist");
  };

  // Handle Dropbox token expiration
  useEffect(() => {
    const handleTokenExpired = () => {
      const now = Date.now();
      // Only show dialog if last one was more than 3 seconds ago
      if (now - lastDialogTime > 3000) {
        setLastDialogTime(now);
        setShowDropboxDialog(true);
      }
    };

    const handleAuthRequired = () => {
      const now = Date.now();
      // Only show dialog if last one was more than 3 seconds ago
      if (now - lastDialogTime > 3000) {
        setLastDialogTime(now);
        setShowDropboxDialog(true);
      }
    };

    window.addEventListener('dropboxTokenExpired', handleTokenExpired);
    window.addEventListener('dropboxAuthRequired', handleAuthRequired);

    return () => {
      window.removeEventListener('dropboxTokenExpired', handleTokenExpired);
      window.removeEventListener('dropboxAuthRequired', handleAuthRequired);
    };
  }, []);

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


  // Check if we should show empty state or main library
  const hasNoContent = tracks.length === 0 && playlists.length === 0;
  const isDropboxRoute = searchParams.get('dropbox') === 'true';
  
  if (hasNoContent && !showDropboxAccordion) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header 
          playlists={[]}
          currentView={currentView}
          onViewChange={() => {}}
          onPlaylistSelect={() => {}}
          searchTerm=""
          onSearchChange={() => {}}
        />
        <EmptyLibraryState 
          onDropboxConnected={() => {
            setShowDropboxAccordion(true);
            localStorage.setItem('showDropboxAccordion', 'true');
            navigate('/'); // Navigate to main library
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <audio ref={audioRef} />
      <Header 
        playlists={filteredPlaylists}
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          if (view === "library") setSelectedPlaylist(null);
        }}
        onPlaylistSelect={handleViewPlaylist}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Hidden on mobile, overlay on tablet */}
        <div className="hidden md:flex md:w-64 lg:w-80">
          <Sidebar 
            playlists={filteredPlaylists}
            currentView={currentView}
            onViewChange={(view) => {
              setCurrentView(view);
              if (view === "library") setSelectedPlaylist(null);
            }}
            onPlaylistSelect={handleViewPlaylist}
            libraryTitle={currentLibraryTitle}
            selectedPlaylist={selectedPlaylist}
            tracks={tracks}
          />
        </div>
        
        <main className={`flex-1 overflow-auto ${currentTrack ? 'pb-20 sm:pb-24' : ''}`}>
          {currentView === "library" ? (
            <MusicLibrary 
              tracks={filteredTracks} 
              onPlayTrack={handlePlayTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              searchTerm={searchTerm}
              onTitleChange={setCurrentLibraryTitle}
              showDropboxAccordion={showDropboxAccordion}
              pendingTracks={pendingTracks}
              onRetryPendingTrack={() => {/* TODO: Implement retry logic */}}
              onPendingTracksChange={setPendingTracks}
            />
          ) : (
            <PlaylistView 
              playlistId={selectedPlaylist?.id || ""}
              onPlayTrack={handlePlayTrack}
              onBack={() => {
                setCurrentView("library");
                setSelectedPlaylist(null);
              }}
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
