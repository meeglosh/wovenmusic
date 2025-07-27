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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePlaylist } from "@/hooks/usePlaylists";
import { usePlaylistCategories, useAssignPlaylistCategory, useCreatePlaylistCategory } from "@/hooks/usePlaylistCategories";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Rocket, LogIn, Plus } from "lucide-react";

interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreatePlaylistModal = ({ open, onOpenChange }: CreatePlaylistModalProps) => {
  const [playlistName, setPlaylistName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  
  const createPlaylistMutation = useCreatePlaylist();
  const assignCategoryMutation = useAssignPlaylistCategory();
  const createCategoryMutation = useCreatePlaylistCategory();
  const { data: categories = [] } = usePlaylistCategories();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  

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
      const newPlaylist = await createPlaylistMutation.mutateAsync(playlistName.trim());
      
      // Assign category if one was selected
      if (selectedCategoryId && newPlaylist) {
        try {
          await assignCategoryMutation.mutateAsync({
            playlistId: newPlaylist.id,
            categoryId: selectedCategoryId
          });
        } catch (categoryError) {
          console.error("Error assigning category:", categoryError);
          // Don't fail the whole operation if category assignment fails
        }
      }
      
      toast({
        title: "Playlist created!",
        description: `"${playlistName}" has been added to your library.`,
      });
      
      setPlaylistName("");
      setSelectedCategoryId("");
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

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const newCategory = await createCategoryMutation.mutateAsync({
        name: newCategoryName.trim()
      });

      setShowCreateCategory(false);
      setNewCategoryName("");
      setSelectedCategoryId(newCategory.id);

      toast({
        title: "Category created",
        description: `"${newCategoryName.trim()}" category has been created.`,
      });
    } catch (error) {
      toast({
        title: "Error creating category",
        description: "Could not create category. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setPlaylistName("");
    setSelectedCategoryId("");
    setNewCategoryName("");
    setShowCreateCategory(false);
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

            <div className="grid gap-2">
              <Label htmlFor="category">Category (optional)</Label>
              {!showCreateCategory ? (
                <div className="space-y-2">
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No category</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreateCategory(true);
                        setNewCategoryName("");
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create new category
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateCategory();
                      } else if (e.key === 'Escape') {
                        setShowCreateCategory(false);
                        setNewCategoryName("");
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                      className="flex-1"
                    >
                      {createCategoryMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              className="text-primary"
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