
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, MoreHorizontal, Clock } from "lucide-react";
import { Track } from "@/types/music";
import DropboxSync from "./DropboxSync";

interface MusicLibraryProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}

const MusicLibrary = ({ tracks, onPlayTrack }: MusicLibraryProps) => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Your Library</h2>
        <div className="text-sm text-muted-foreground">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Dropbox Sync Section */}
      <DropboxSync />

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <div className="text-2xl text-primary/60">♪</div>
            </div>
            <h3 className="text-xl font-semibold mb-2">No tracks yet</h3>
            <p className="text-muted-foreground mb-4">Connect your Dropbox to sync your music library automatically.</p>
          </div>
        </div>
      ) : (
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
                  <span className="text-muted-foreground text-sm group-hover:opacity-0 transition-opacity">
                    {index + 1}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20">
                    <div className="flex space-x-px">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary/60 wave-bar rounded-full"
                          style={{ height: `${Math.random() * 16 + 4}px` }}
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
      )}
    </div>
  );
};

export default MusicLibrary;
