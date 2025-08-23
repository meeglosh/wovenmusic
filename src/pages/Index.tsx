
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MusicLibrary from "@/components/MusicLibrary";
import PlaylistView from "@/components/PlaylistView";
import PlaylistsGrid from "@/components/PlaylistsGrid";
import Player from "@/components/Player";
import FullScreenPlayer from "@/components/FullScreenPlayer";
import EmptyLibraryState from "@/components/EmptyLibraryState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { Track, Playlist, PendingTrack } from "@/types/music";
import { useTracks } from "@/hooks/useTracks";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
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
  const [activeTab, setActiveTab] = useState<"library" | "playlists">(() => (location.pathname.startsWith("/library") ? "library" : "playlists"));
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentLibraryTitle, setCurrentLibraryTitle] = useState("Driftspace");
  const [showDropboxDialog, setShowDropboxDialog] = useState(false);
  const [showDropboxAccordion, setShowDropboxAccordion] = useState(false);
  const [lastDialogTime, setLastDialogTime] = useState(0);
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(() => {
    const saved = localStorage.getItem('player-minimized');
    return saved ? JSON.parse(saved) : false;
  });

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

  // Save minimized state to localStorage
  useEffect(() => {
    localStorage.setItem('player-minimized', JSON.stringify(isPlayerMinimized));
  }, [isPlayerMinimized]);

  // Auto-expand player when new track starts playing
  useEffect(() => {
    if (currentTrack && isPlayerMinimized) {
      setIsPlayerMinimized(false);
    }
  }, [currentTrack]);

  // Sync active tab with the current route
  useEffect(() => {
    setActiveTab(location.pathname.startsWith("/library") ? "library" : "playlists");
  }, [location.pathname]);

  // Cleanup any scroll-blocking states from modals/sheets
  useEffect(() => {
    const cleanup = () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
    };
    
    cleanup();
    
    // Cleanup on route changes
    return cleanup;
  }, [location.pathname, activeTab]);
  const handleMinimizePlayer = () => {
    setIsPlayerMinimized(true);
  };

  const handleExpandPlayer = () => {
    setIsPlayerMinimized(false);
  };

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

  const handlePlayPlaylist = (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && playlist.trackIds.length > 0) {
      const playlistTracks = tracks.filter(track => 
        playlist.trackIds.includes(track.id)
      );
      if (playlistTracks.length > 0) {
        playPlaylist(playlistTracks, 0, {
          id: playlist.id,
          name: playlist.name,
          imageUrl: playlist.imageUrl
        });
      }
    }
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
          tracks={[]}
        />
        <EmptyLibraryState 
          onDropboxConnected={() => {
            setShowDropboxAccordion(true);
            navigate('/library'); // Navigate to main library
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
        tracks={tracks}
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
        
        <main className="flex-1 min-h-screen overflow-y-auto overscroll-auto" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
          <div className={`${currentTrack ? 'pb-20 sm:pb-24' : ''}`}>
            {currentView === "library" ? (
              <div className="p-6 pb-2">
                {/* Mobile Search - Only show on mobile */}
                <div className="md:hidden mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input 
                      placeholder="Search tracks, playlists..." 
                      className="pl-10 bg-muted/30 border-muted"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <Tabs value={activeTab} onValueChange={(value) => {
                  if (value === "playlists") {
                    setActiveTab("playlists");
                    if (location.pathname !== "/playlists") navigate("/playlists");
                  } else {
                    setActiveTab("library");
                    if (location.pathname !== "/library") navigate("/library");
                  }
                }}>
                  <TabsList className="bg-muted/50 p-1 mb-6 gap-3 rounded-md">
                    <TabsTrigger value="playlists" className="rounded-md border border-border data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-base leading-6 touch-manipulation select-none cursor-pointer">
                      Playlists
                    </TabsTrigger>
                    <TabsTrigger value="library" className="rounded-md border border-border data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-base leading-6 touch-manipulation select-none cursor-pointer">
                      Library
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="library" className="mt-0 -m-6">
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
                  </TabsContent>
                  
                   <TabsContent value="playlists" className="mt-0 -m-6">
                     <PlaylistsGrid 
                       playlists={filteredPlaylists}
                       tracks={tracks}
                        onPlayPlaylist={(playlistId) => {
                          const playlist = playlists.find(p => p.id === playlistId);
                          if (playlist) {
                            const ordered = playlist.trackIds
                              .map((id) => tracks.find((t) => t.id === id))
                              .filter((t): t is Track => !!t);
                            playPlaylist(ordered, 0, {
                              id: playlist.id,
                              name: playlist.name,
                              imageUrl: playlist.imageUrl
                            });
                          }
                        }}
                       onPlaylistSelect={handleViewPlaylist}
                     />
                   </TabsContent>
                </Tabs>
              </div>
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
          </div>
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
          isMinimized={isPlayerMinimized}
          onPlayPause={togglePlayPause}
          onSeek={seekTo}
          onVolumeChange={setVolume}
          onNext={playNext}
          onPrevious={playPrevious}
          onShuffle={toggleShuffle}
          onRepeat={toggleRepeat}
          onFullScreen={() => setShowFullScreen(true)}
          onMinimize={handleMinimizePlayer}
          onExpand={handleExpandPlayer}
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
