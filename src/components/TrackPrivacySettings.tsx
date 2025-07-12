import { useState } from "react";
import { Track } from "@/types/music";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Globe } from "lucide-react";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useToast } from "@/hooks/use-toast";

interface TrackPrivacySettingsProps {
  track: Track;
}

export function TrackPrivacySettings({ track }: TrackPrivacySettingsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();

  const handlePrivacyChange = async (isPublic: boolean) => {
    setIsUpdating(true);
    try {
      await updateTrackMutation.mutateAsync({
        id: track.id,
        updates: { is_public: isPublic }
      });
      
      toast({
        title: "Privacy updated",
        description: `Track is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update track privacy",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          {track.is_public ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          Track Privacy
        </CardTitle>
        <CardDescription>
          Control who can access this track
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="track-privacy" className="text-sm font-medium">
              Make track public
            </Label>
            <p className="text-sm text-muted-foreground">
              {track.is_public 
                ? "Anyone can discover and listen to this track" 
                : "Only you can access this track"
              }
            </p>
          </div>
          <Switch
            id="track-privacy"
            checked={track.is_public || false}
            onCheckedChange={handlePrivacyChange}
            disabled={isUpdating}
          />
        </div>
      </CardContent>
    </Card>
  );
}