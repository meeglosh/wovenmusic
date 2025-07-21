import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Lock, Globe, Music, ListMusic, Search, ArrowLeft, Eye, EyeOff, Settings } from "lucide-react";
import { useTracks, useUpdateTrack } from "@/hooks/useTracks";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useUpdatePlaylistVisibility } from "@/hooks/usePlaylistSharing";
import { useToast } from "@/hooks/use-toast";
import { useTranscodingPreferences, TranscodingFormat } from "@/hooks/useTranscodingPreferences";
import { Track } from "@/types/music";
import { getFileName } from "@/types/music";
import { useNavigate } from "react-router-dom";

export default function PrivacySettings() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: tracks = [] } = useTracks();
  const { data: playlists = [] } = usePlaylists();
  const updateTrackMutation = useUpdateTrack();
  const updatePlaylistVisibility = useUpdatePlaylistVisibility();
  const { preferences, updateOutputFormat } = useTranscodingPreferences();
  const { toast } = useToast();
  const navigate = useNavigate();

  const filteredTracks = tracks.filter(track => 
    getFileName(track).toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPlaylists = playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTrackPrivacyChange = async (track: Track, isPublic: boolean) => {
    try {
      await updateTrackMutation.mutateAsync({
        id: track.id,
        updates: { is_public: isPublic }
      });
      
      toast({
        title: "Privacy updated",
        description: `"${getFileName(track)}" is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update track privacy",
        variant: "destructive",
      });
    }
  };

  const handlePlaylistPrivacyChange = async (playlistId: string, playlistName: string, isPublic: boolean) => {
    try {
      await updatePlaylistVisibility.mutateAsync({
        playlistId,
        isPublic
      });
      
      toast({
        title: "Privacy updated",
        description: `"${playlistName}" is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update playlist privacy",
        variant: "destructive",
      });
    }
  };

  const publicTracks = tracks.filter(track => track.is_public);
  const privateTracks = tracks.filter(track => !track.is_public);
  const publicPlaylists = playlists.filter(playlist => playlist.isPublic);
  const privatePlaylists = playlists.filter(playlist => !playlist.isPublic);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 text-primary" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Privacy Settings</h1>
          <p className="text-muted-foreground">Seal the vault or crack it to the stars.</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Public Tracks</p>
                <p className="font-semibold">{publicTracks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-sm text-muted-foreground">Private Tracks</p>
                <p className="font-semibold">{privateTracks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Public Playlists</p>
                <p className="font-semibold">{publicPlaylists.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-sm text-muted-foreground">Private Playlists</p>
                <p className="font-semibold">{privatePlaylists.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tracks and playlists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-8">
        {/* Transcoding Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Audio Transcoding Preferences
            </CardTitle>
            <CardDescription>
              Choose your preferred format for audio transcoding. This affects how .aif/.aiff files are converted for browser playback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="transcoding-format"
                  checked={preferences.outputFormat === 'aac'}
                  onCheckedChange={(checked) => updateOutputFormat(checked ? 'aac' : 'mp3')}
                />
                <Label htmlFor="transcoding-format" className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {preferences.outputFormat === 'aac' ? 'AAC (High Quality)' : 'MP3 (Compatible)'}
                    </span>
                    <Badge variant="secondary" className="ml-2">
                      {preferences.outputFormat.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {preferences.outputFormat === 'aac' 
                      ? 'Better audio quality at the same bitrate (320kbps)' 
                      : 'Most compatible with browsers and devices (256kbps)'}
                  </p>
                </Label>
              </div>
              <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                <strong>Note:</strong> This setting only affects future uploads of .aif/.aiff files. 
                Existing files and other formats are not affected.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracks Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Track Privacy ({filteredTracks.length})
            </CardTitle>
            <CardDescription>
              Control which tracks are visible to the public. Private tracks are only visible to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredTracks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchQuery ? "No tracks found matching your search." : "No tracks available."}
                </p>
              ) : (
                filteredTracks.map((track) => (
                  <div key={track.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{getFileName(track)}</p>
                        <p className="text-sm text-muted-foreground">{track.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`track-${track.id}`} className="text-sm flex items-center gap-1">
                        {track.is_public ? (
                          <>
                            <Globe className="h-3 w-3" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            Private
                          </>
                        )}
                      </Label>
                      <Switch
                        id={`track-${track.id}`}
                        checked={track.is_public || false}
                        onCheckedChange={(checked) => handleTrackPrivacyChange(track, checked)}
                        disabled={updateTrackMutation.isPending}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Playlists Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" />
              Playlist Privacy ({filteredPlaylists.length})
            </CardTitle>
            <CardDescription>
              Control which playlists are visible to the public. Private playlists are only visible to you and people you share them with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredPlaylists.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchQuery ? "No playlists found matching your search." : "No playlists available."}
                </p>
              ) : (
                filteredPlaylists.map((playlist) => (
                  <div key={playlist.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <ListMusic className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{playlist.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {playlist.trackIds.length} track{playlist.trackIds.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`playlist-${playlist.id}`} className="text-sm flex items-center gap-1">
                        {playlist.isPublic ? (
                          <>
                            <Globe className="h-3 w-3" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            Private
                          </>
                        )}
                      </Label>
                      <Switch
                        id={`playlist-${playlist.id}`}
                        checked={playlist.isPublic || false}
                        onCheckedChange={(checked) => handlePlaylistPrivacyChange(playlist.id, playlist.name, checked)}
                        disabled={updatePlaylistVisibility.isPending}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}