import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePlaylist } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Rocket, LogIn } from "lucide-react";

interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreatePlaylistModal = ({ open, onOpenChange }: CreatePlaylistModalProps) => {
  const [playlistName, setPlaylistName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const createPlaylistMutation = useCreatePlaylist();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to create playlists.",
        variant: "destructive",
      });
      return;
    }

    if (!playlistName.trim()) {
      toast({
        title: "Playlist name required",
        description: "Please enter a name for your playlist.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await createPlaylistMutation.mutateAsync(playlistName.trim());
      
      toast({
        title: "Playlist created!",
        description: `"${playlistName}" has been added to your library.`,
      });
      
      setPlaylistName("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error creating playlist",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPlaylistName("");
    onOpenChange(false);
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Create Playlist
            </DialogTitle>
            <DialogDescription>
              You need to be logged in to create playlists.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <LogIn className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Log in to create and manage your personal playlists
            </p>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              Log In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Create Playlist
          </DialogTitle>
          <DialogDescription>
            Birth a capsule for the vibrations that claim you.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Playlist name</Label>
              <Input
                id="name"
                placeholder="My awesome playlist"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="col-span-3"
                autoFocus
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {playlistName.length}/100 characters
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="text-primary border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !playlistName.trim()}
              className="min-w-[100px]"
            >
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePlaylistModal;