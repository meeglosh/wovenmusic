
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, MoreHorizontal, Clock } from "lucide-react";
import { Track } from "@/types/music";

interface MusicLibraryProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}

const MusicLibrary = ({ tracks, onPlayTrack }: MusicLibraryProps) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Your Library</h2>
        <div className="text-sm text-muted-foreground">
          {tracks.length} tracks
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[auto,1fr,auto,auto,auto] gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
          <div className="w-12"></div>
          <div>Title</div>
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
          </div>
          <div>Added</div>
          <div className="w-12"></div>
        </div>

        <div className="divide-y divide-border">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="grid grid-cols-[auto,1fr,auto,auto,auto] gap-4 p-4 hover:bg-muted/30 transition-colors group"
            >
              <div className="w-12 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onPlayTrack(track)}
                >
                  <Play className="w-4 h-4 fill-current" />
                </Button>
                {!track && (
                  <span className="text-muted-foreground text-sm">
                    {index + 1}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20">
                  <div className="flex space-x-px">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-primary/60 wave-bar rounded-full"
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium">{track.title}</p>
                  <p className="text-sm text-muted-foreground">{track.artist}</p>
                </div>
              </div>

              <div className="flex items-center text-muted-foreground">
                {track.duration}
              </div>

              <div className="flex items-center text-sm text-muted-foreground">
                {track.addedAt.toLocaleDateString()}
              </div>

              <div className="w-12 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default MusicLibrary;
