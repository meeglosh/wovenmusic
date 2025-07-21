import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Settings, Music, Info } from "lucide-react";
import { useTranscodingPreferences } from "@/hooks/useTranscodingPreferences";
import { useNavigate } from "react-router-dom";

export default function TranscodingSettings() {
  const { preferences, updateOutputFormat } = useTranscodingPreferences();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 text-primary" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Transcoding Settings</h1>
            <p className="text-muted-foreground">Configure audio format preferences for uploads.</p>
          </div>
        </div>

        {/* Transcoding Format Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Audio Format Preference
            </CardTitle>
            <CardDescription>
              Choose your preferred format for audio transcoding. This affects how files requiring conversion are processed for browser playback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
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

              {/* Format Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className={`border-2 ${preferences.outputFormat === 'mp3' ? 'border-primary' : 'border-border'}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      MP3
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Most compatible format</li>
                      <li>• Works on all browsers and devices</li>
                      <li>• 256kbps encoding</li>
                      <li>• Slightly larger file sizes</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${preferences.outputFormat === 'aac' ? 'border-primary' : 'border-border'}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      AAC
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Superior audio quality</li>
                      <li>• More efficient compression</li>
                      <li>• 320kbps encoding</li>
                      <li>• Smaller file sizes</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Important Note */}
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-primary mb-1">What files are affected?</p>
                  <p className="text-muted-foreground">
                    This setting affects future uploads of <strong>.wav, .aif, and .aiff</strong> files that require transcoding for browser compatibility. 
                    Existing files and formats that play natively (.mp3, .m4a, etc.) are not affected.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}