
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle } from "lucide-react";
import { Track } from "@/types/music";

interface PlayerProps {
  track: Track;
  isPlaying: boolean;
  onPlayPause: () => void;
}

const Player = ({ track, isPlaying, onPlayPause }: PlayerProps) => {
  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between">
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
            <p className="font-medium">{track.title}</p>
            <p className="text-sm text-muted-foreground">{track.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center space-y-2 flex-1">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
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
            <Button variant="ghost" size="sm">
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Repeat className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 w-full max-w-md">
            <span className="text-xs text-muted-foreground">0:00</span>
            <Slider
              value={[0]}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground">{track.duration}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center space-x-2 flex-1 justify-end">
          <Volume2 className="w-4 h-4" />
          <Slider
            value={[75]}
            max={100}
            step={1}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
};

export default Player;
