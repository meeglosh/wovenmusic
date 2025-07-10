import { useParams, useNavigate } from "react-router-dom";
import { useTracks } from "@/hooks/useTracks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import FullScreenPlayer from "@/components/FullScreenPlayer";
import { Loader2 } from "lucide-react";

const TrackView = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { data: tracks, isLoading } = useTracks();
  const audioPlayer = useAudioPlayer();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const track = tracks?.find(t => t.id === trackId);

  if (!track) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Track not found</h1>
          <p className="text-muted-foreground mb-4">The track you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate('/')}
            className="text-primary hover:underline"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // Auto-play the track if it's not already the current track
  if (audioPlayer.currentTrack?.id !== track.id) {
    audioPlayer.playTrack(track);
  }

  return (
    <FullScreenPlayer
      track={track}
      isPlaying={audioPlayer.isPlaying}
      currentTime={audioPlayer.currentTime}
      duration={audioPlayer.duration}
      audioRef={audioPlayer.audioRef}
      onClose={() => navigate('/')}
      onTogglePlayPause={audioPlayer.togglePlayPause}
      onSeek={audioPlayer.seekTo}
      formatTime={audioPlayer.formatTime}
    />
  );
};

export default TrackView;