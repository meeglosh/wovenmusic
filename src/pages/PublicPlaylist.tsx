import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Play, Pause, ExternalLink, LogIn, Share2, Check, ArrowLeft, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlaylistThumbnail } from "@/components/PlaylistThumbnail";
import { useToast } from "@/hooks/use-toast";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { usePublicPlaylist, usePublicPlaylistByToken } from "@/hooks/usePublicPlaylist";
import { Track } from "@/types/music";
import { formatSecondsToDuration, parseDurationToSeconds, getCleanTitle } from "@/types/music";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Player from "@/components/Player";
import { useClosedBeta } from "@/hooks/useClosedBeta";
import ClosedBetaSplash from "@/components/ClosedBetaSplash";

const PublicPlaylist = () => {
  console.log("PublicPlaylist component mounting");
  console.log("Rendering PublicPlaylist", { pathname: window.location.pathname, href: window.location.href });
  console.log("Current search params:", window.location.search);
  
  const { playlistId } = useParams<{ playlistId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Manage user state independently to avoid auth redirects
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [shareButtonCopied, setShareButtonCopied] = useState(false);
  const [showClosedBetaSplash, setShowClosedBetaSplash] = useState(false);
  
  const { isClosedBeta } = useClosedBeta();

  // Check for authenticated user without redirecting
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setUserLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setUserLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if accessing by share token or playlist ID
  const shareToken = searchParams.get("playlist") || searchParams.get("token");
  const shouldUseToken = !!shareToken && (!playlistId || playlistId === "shared");

  // Fetch playlist data
  const { 
    data: playlist, 
    isLoading, 
    error 
  } = shouldUseToken 
    ? usePublicPlaylistByToken(shareToken!)
    : usePublicPlaylist(playlistId!);

  // Debug logging
  useEffect(() => {
    console.log("PublicPlaylist Debug:", {
      playlistId,
      shareToken,
      shouldUseToken,
      isLoading,
      error: error?.message,
      playlist: playlist?.name,
      trackCount: playlist?.tracks?.length,
      userLoading,
      hasUser: !!user,
      currentUrl: window.location.href
    });
    
    // Log raw data for debugging
    if (playlist) {
      console.log("Full playlist data:", playlist);
    }
    if (error) {
      console.log("Full error:", error);
    }
  }, [playlistId, shareToken, shouldUseToken, isLoading, error, playlist, userLoading, user]);

  // Audio player functionality
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffleMode,
    isRepeatMode,
    audioRef,
    playPlaylist,
    togglePlayPause,
    seekTo,
    setVolume,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    formatTime
  } = useAudioPlayer();

  const handlePlayTrack = (track: Track, trackList?: Track[]) => {
    const playlistTracks = trackList || playlist?.tracks || [];
    
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      const startIndex = playlistTracks.findIndex(t => t.id === track.id);
      playPlaylist(playlistTracks, startIndex !== -1 ? startIndex : 0);
    }
  };

  const handlePlayPlaylist = () => {
    if (playlist?.tracks && playlist.tracks.length > 0) {
      playPlaylist(playlist.tracks, 0, {
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlist.imageUrl
      });
    }
  };

  const handleRestrictedAction = () => {
    if (!user) {
      setShowSignInPrompt(true);
    } else {
      toast({
        title: "Access Restricted",
        description: "This action requires playlist ownership or band membership"
      });
    }
  };

  const handleSignIn = () => {
    if (isClosedBeta) {
      setShowClosedBetaSplash(true);
    } else {
      navigate("/auth");
    }
  };

  const handleSharePlaylist = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setShareButtonCopied(true);
      toast({
        title: "Link copied!",
        description: "Playlist link has been copied to your clipboard"
      });
      setTimeout(() => setShareButtonCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually from your browser"
      });
    }
  };

  const calculateTotalDuration = () => {
    if (!playlist?.tracks) return "0:00";
    
    const totalSeconds = playlist.tracks.reduce((acc, track) => {
      return acc + parseDurationToSeconds(track.duration);
    }, 0);
    
    return formatSecondsToDuration(totalSeconds);
  };

  // Show loading state with timeout warning
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <h2 className="text-lg font-semibold mb-2 text-primary">Loading playlist...</h2>
          <p className="text-muted-foreground text-sm mb-4">
            This may take a few seconds
          </p>
          <p className="text-xs text-muted-foreground">
            If this takes longer than 15 seconds, there may be a connection issue.
          </p>
        </div>
      </div>
    );
  }

  // Show error state with detailed debugging
  if (error || !playlist) {
    const errorMessage = error?.message || "Unknown error occurred";
    const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("522");
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="flex justify-center mx-auto mb-4">
            <img 
              src="/lovable-uploads/72581c98-2f3b-4984-8aba-04e8a3ef7820.png" 
              alt="Error" 
              className="w-32 h-32 object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold mb-2 text-primary">
            {isTimeout ? "Connection Timeout" : "Playlist Not Found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isTimeout 
              ? "The request timed out. This may be due to a database connection issue."
              : "This weave is absent, veiled, or softly erased."
            }
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2 text-primary" />
            <span className="text-primary">Go Home</span>
          </Button>
        </div>
      </div>
    );
  }

  // Show closed beta splash if triggered by sign-in attempt
  if (showClosedBetaSplash) {
    return <ClosedBetaSplash />;
  }

  return (
    <div className="min-h-screen bg-background">
      <audio ref={audioRef} />
      
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-thin text-xl text-primary">Wovenmusic</span>
            
            {!user && (
              <Button onClick={handleSignIn} size="sm" className="bg-primary hover:bg-primary/90">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Playlist Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="flex-shrink-0">
            <PlaylistThumbnail
              imageUrl={playlist.imageUrl}
              name={playlist.name}
              className="w-48 h-48 shadow-lg"
              priority={true}
              size="lg"
            />
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary" className="text-left">Public Playlist</Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSharePlaylist}
                  className="border-2"
                >
                  {shareButtonCopied ? (
                    <Check className="w-4 h-4 mr-2 text-primary" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2 text-primary" />
                  )}
                  <span className="text-primary">
                    {shareButtonCopied ? "Copied!" : "Share"}
                  </span>
                </Button>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {playlist.name}
              </h1>
              <div className="text-muted-foreground space-y-1">
                <p>{playlist.tracks.length} tracks • {calculateTotalDuration()}</p>
                <p>Created {playlist.createdAt.toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={handlePlayPlaylist}
                disabled={playlist.tracks.length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                <Play className="w-4 h-4 mr-2" />
                Play All
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleRestrictedAction}
                className="border-2 border-primary/20 hover:border-primary"
              >
                <ExternalLink className="w-4 h-4 mr-2 text-primary" />
                <span className="text-primary">Open in App</span>
              </Button>
            </div>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Track List */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold mb-4 text-primary">Tracks</h2>
          
          {playlist.tracks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No public tracks in this playlist</p>
              </CardContent>
            </Card>
          ) : (
            playlist.tracks.map((track, index) => (
              <Card 
                key={track.id} 
                className={`transition-colors hover:bg-accent/50 cursor-pointer ${
                  currentTrack?.id === track.id ? 'bg-primary/10 border-primary/20' : ''
                }`}
                onClick={() => handlePlayTrack(track, playlist.tracks)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-8 text-center">
                      {currentTrack?.id === track.id && isPlaying ? (
                        <Pause className="w-4 h-4 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {getCleanTitle(track)}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {track.artist}
                      </p>
                    </div>
                    
                    {/* Privacy indicator */}
                    <div className="flex-shrink-0" title={track.is_public ? "Public track" : "Private track"}>
                      {track.is_public ? (
                        <Globe className="w-4 h-4 text-green-500" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-shrink-0 text-sm text-muted-foreground">
                      {track.duration}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Sign In Prompt Modal */}
      {showSignInPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to access your personal library, create playlists, and more.
              </p>
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSignInPrompt(false)}
                  className="flex-1"
                >
                  Continue Browsing
                </Button>
                <Button 
                  onClick={handleSignIn}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky Media Player */}
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
          formatTime={formatTime}
        />
      )}
    </div>
  );
};

export default PublicPlaylist;