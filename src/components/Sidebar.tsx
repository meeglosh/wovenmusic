
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Plus, Library, List } from "lucide-react";
import { Playlist } from "@/types/music";
import { cn } from "@/lib/utils";
import CreatePlaylistModal from "./CreatePlaylistModal";

interface SidebarProps {
  playlists: Playlist[];
  currentView: "library" | "playlist";
  onViewChange: (view: "library" | "playlist") => void;
  onPlaylistSelect: (playlist: Playlist) => void;
}

const Sidebar = ({ playlists, currentView, onViewChange, onPlaylistSelect }: SidebarProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  return (
    <aside className="w-64 bg-card/30 border-r border-border flex flex-col">
      <div className="p-4">
        <nav className="space-y-2">
          <Button
            variant={currentView === "library" ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => onViewChange("library")}
          >
            <Library className="w-4 h-4 mr-3" />
            Your Library
          </Button>
        </nav>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Playlists</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1">
            {playlists.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
                  <List className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No playlists yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first playlist</p>
              </div>
            ) : (
              playlists.map((playlist) => (
                <Button
                  key={playlist.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto p-3 text-left",
                    "hover:bg-muted/50 transition-colors"
                  )}
                  onClick={() => onPlaylistSelect(playlist)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                      <List className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{playlist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {playlist.trackIds.length} track{playlist.trackIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      <CreatePlaylistModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />
    </aside>
  );
};

export default Sidebar;
