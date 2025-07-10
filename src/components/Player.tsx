
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, Maximize2 } from "lucide-react";
import { Track, getExtensionWithStatus } from "@/types/music";

interface PlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffleMode?: boolean;
  isRepeatMode?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onShuffle?: () => void;
  onRepeat?: () => void;
  onFullScreen?: () => void;
  formatTime: (time: number) => string;
}

const Player = ({ 
  track, 
  isPlaying, 
  currentTime, 
  duration, 
  volume, 
  isShuffleMode = false,
  isRepeatMode = false,
  onPlayPause, 
  onSeek, 
  onVolumeChange, 
  onNext,
  onPrevious,
  onShuffle,
  onRepeat,
  onFullScreen,
  formatTime 
}: PlayerProps) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (values: number[]) => {
    const newTime = (values[0] / 100) * duration;
    onSeek(newTime);
  };

  const handleVolumeChange = (values: number[]) => {
    onVolumeChange(values[0] / 100);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm p-4 shadow-lg">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        {/* Track Info */}
        <div className="flex items-center space-x-4 flex-1">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20">
            <div className="flex space-x-px">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-0.5 bg-primary/60 rounded-full ${
                    isPlaying ? 'wave-bar' : 'h-2'
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{track.title}</p>
              {(() => {
                const { extension, compatible } = getExtensionWithStatus(track);
                return extension ? (
                  <span 
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      compatible 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-red-100 text-red-700 border border-red-200'
                    }`}
                    title={compatible ? 'Compatible format' : 'May not play in all browsers'}
                  >
                    .{extension}
                  </span>
                ) : null;
              })()}
            </div>
            <p className="text-sm text-muted-foreground">{track.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center space-y-2 flex-1">
          <div className="flex items-center space-x-4">
            <Button 
              variant={isShuffleMode ? "default" : "ghost"} 
              size="sm"
              onClick={onShuffle}
              disabled={!onShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onPrevious}
              disabled={!onPrevious}
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              className="w-10 h-10 rounded-full"
              onClick={onPlayPause}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onNext}
              disabled={!onNext}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button 
              variant={isRepeatMode ? "default" : "ghost"} 
              size="sm"
              onClick={onRepeat}
              disabled={!onRepeat}
            >
              <Repeat className="w-4 h-4" />
            </Button>
            {onFullScreen && (
              <Button variant="ghost" size="sm" onClick={onFullScreen}>
                <Maximize2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-2 w-full max-w-md">
            <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              className="flex-1"
              onValueChange={handleSeek}
            />
            <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center space-x-2 flex-1 justify-end">
          <Volume2 className="w-4 h-4" />
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            className="w-20"
            onValueChange={handleVolumeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Player;
