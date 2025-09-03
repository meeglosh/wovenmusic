import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, Trash2, Users, Globe, Lock } from "lucide-react";
import { Playlist } from "@/types/music";
import { useSharePlaylist, useUpdatePlaylistVisibility, useRemovePlaylistShare } from "@/hooks/usePlaylistSharing";
import { usePermissions } from "@/hooks/usePermissions";
import { generatePlaylistShareUrl } from "@/lib/config";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";
import { playlistImageSrc } from "@/services/imageFor";
import { coverUrlForPlaylist } from "@/services/covers";

interface SharePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: Playlist;
}

export default function SharePlaylistModal({ open, onOpenChange, playlist }: SharePlaylistModalProps) {
  const [email, setEmail] = useState("");
  const [isPublic, setIsPublic] = useState(playlist.isPublic || false);
  
  const sharePlaylistMutation = useSharePlaylist();
  const updateVisibilityMutation = useUpdatePlaylistVisibility();
  const removeShareMutation = useRemovePlaylistShare();
  const { canEditPlaylistPrivacy } = usePermissions();

  // Prefer 300x300 thumb, then full cover, then any legacy imageUrl
  const coverSrc =
    coverUrlForPlaylist(playlist as any) ??
    playlistImageSrc(playlist as any) ??
    (playlist as any)?.imageUrl;

  const handleShareByEmail = async () => {
    if (!email.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      await sharePlaylistMutation.mutateAsync({
        playlistId: playlist.id,
        email: email.trim()
      });
      setEmail("");
      toast.success("Playlist shared successfully!");
    } catch (error) {
      toast.error("Failed to share playlist. Please try again.");
    }
  };

  const handleTogglePublic = async () => {
    try {
      await updateVisibilityMutation.mutateAsync({
        playlistId: playlist.id,
        isPublic: !isPublic
      });
      setIsPublic(!isPublic);
      toast.success(`Playlist ${!isPublic ? "made public" : "made private"}`);
    } catch (error) {
      toast.error("Failed to update playlist visibility");
    }
  };

  const handleRemoveShare = async (email: string) => {
    try {
      await removeShareMutation.mutateAsync({
        playlistId: playlist.id,
        email
      });
      toast.success("Share removed successfully");
    } catch (error) {
      toast.error("Failed to remove share");
    }
  };

  const copyShareLink = () => {
    const shareUrl = generatePlaylistShareUrl(playlist.shareToken, playlist.id);
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Share "{playlist.name}"</span>
          </DialogTitle>
          <DialogDescription>
            Share this playlist with other band members or make it publicly accessible.
          </DialogDescription>
        </DialogHeader>

        {/* Compact cover preview */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center border border-border">
            {coverSrc ? (
              <OptimizedImage
                src={coverSrc}
                alt={`${playlist.name} cover`}
                className="w-full h-full"
                sizes="48px"
                objectFit="cover"
                loading="lazy"
              />
            ) : (
              <span className="text-sm text-muted-foreground">♪</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{playlist.name}</div>
            <Badge variant={isPublic ? "default" : "secondary"} className="mt-1">
              {isPublic ? (
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Public</span>
              ) : (
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Private</span>
              )}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-6 mt-4">
          {/* Public/Private Toggle - Only show to playlist creator or admin */}
          {canEditPlaylistPrivacy(playlist) && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>Make Public</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Anyone with the link can view this playlist
                </p>
              </div>
              <Switch 
                checked={isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={updateVisibilityMutation.isPending}
              />
            </div>
          )}

          {/* Share Link */}
          {isPublic && (
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex space-x-2">
                <Input 
                  value={generatePlaylistShareUrl(playlist.shareToken, playlist.id)}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={copyShareLink} size="icon" variant="outline" className="text-primary hover:text-primary">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Share by Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Share with Specific People</Label>
            <div className="flex space-x-2">
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleShareByEmail()}
              />
              <Button 
                onClick={handleShareByEmail}
                disabled={sharePlaylistMutation.isPending}
              >
                <Mail className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Shared With List */}
          {playlist.sharedWith.length > 0 && (
            <div className="space-y-2">
              <Label>Shared With</Label>
              <div className="space-y-2">
                {playlist.sharedWith.map((sharedEmail) => (
                  <div key={sharedEmail} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm text-primary">{sharedEmail}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveShare(sharedEmail)}
                      disabled={removeShareMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
