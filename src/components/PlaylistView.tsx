
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Share2, Users, MoreHorizontal } from "lucide-react";
import { Track, Playlist } from "@/types/music";

interface PlaylistViewProps {
  playlist: Playlist | null;
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
  onBack: () => void;
}

const PlaylistView = ({ playlist, tracks, onPlayTrack, onBack }: PlaylistViewProps) => {
  if (!playlist) return null;

  const playlistTracks = tracks.filter(track => playlist.trackIds.includes(track.id));

  return (
    <div className="p-6">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Library
      </Button>

      <div className="flex items-start space-x-6 mb-8">
        <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center border border-primary/20">
          <div className="text-6xl text-primary/60">♪</div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <Badge variant="secondary">Playlist</Badge>
            {playlist.sharedWith.length > 0 && (
              <Badge variant="outline" className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>Shared</span>
              </Badge>
            )}
          </div>
          
          <h1 className="text-5xl font-bold mb-4">{playlist.name}</h1>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-6">
            <span>{playlistTracks.length} tracks</span>
            <span>•</span>
            <span>Created {playlist.createdAt.toLocaleDateString()}</span>
            {playlist.sharedWith.length > 0 && (
              <>
                <span>•</span>
                <span>Shared with {playlist.sharedWith.length} members</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button size="lg" className="rounded-full">
              <Play className="w-5 h-5 mr-2 fill-current" />
              Play All
            </Button>
            <Button variant="outline" size="lg">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="lg">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {playlistTracks.map((track, index) => (
            <div
              key={track.id}
              className="grid grid-cols-[auto,1fr,auto,auto] gap-4 p-4 hover:bg-muted/30 transition-colors group"
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

export default PlaylistView;
