
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Plus, Library, List, Lock, Globe } from "lucide-react";
import { Playlist, calculatePlaylistDuration } from "@/types/music";
import { cn } from "@/lib/utils";
import CreatePlaylistModal from "./CreatePlaylistModal";

interface SidebarProps {
  playlists: Playlist[];
  currentView: "library" | "playlist";
  onViewChange: (view: "library" | "playlist") => void;
  onPlaylistSelect: (playlist: Playlist) => void;
  libraryTitle?: string;
  selectedPlaylist?: Playlist | null;
  tracks: any[]; // Add tracks prop to calculate duration
}

const Sidebar = ({ playlists, currentView, onViewChange, onPlaylistSelect, libraryTitle = "Driftspace", selectedPlaylist, tracks }: SidebarProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  return (
    <aside className="w-full h-full bg-card/40 border-r border-border flex flex-col">
      <div className="p-comfortable">
        <nav className="space-y-tight">
          <Button
            variant={currentView === "library" ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start",
              currentView === "library" && "bg-primary/50"
            )}
            onClick={() => onViewChange("library")}
          >
            <Library className="w-4 h-4 mr-3 text-primary" />
            <span className="text-body font-medium text-primary">{libraryTitle}</span>
          </Button>
        </nav>
      </div>

      <div className="px-comfortable pb-comfortable">
        <div className="flex items-center justify-between mb-snug">
          <h3 className="text-caption text-muted-foreground">Playlists</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 text-primary" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-tight">
            {playlists.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
                  <List className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-body text-muted-foreground">No playlists yet</p>
                <p className="text-caption text-muted-foreground mt-tight">Create your first playlist</p>
              </div>
            ) : (
              playlists.map((playlist) => {
                const isSelected = currentView === "playlist" && selectedPlaylist?.id === playlist.id;
                const playlistTracks = tracks.filter(track => playlist.trackIds.includes(track.id));
                const duration = calculatePlaylistDuration(playlistTracks);
                
                return (
                  <Button
                    key={playlist.id}
                    variant={isSelected ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start h-auto p-snug text-left",
                      "hover:bg-primary/40 transition-all duration-200",
                      isSelected && "bg-primary/50 shadow-sm"
                    )}
                  onClick={() => onPlaylistSelect(playlist)}
                >
                  <div className="flex items-center space-x-snug">
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center overflow-hidden">
                      {playlist.imageUrl ? (
                        <img 
                          src={playlist.imageUrl} 
                          alt={`${playlist.name} cover`}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <List className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-tight">
                        <p className="text-body font-medium text-primary break-words whitespace-normal leading-tight">{playlist.name}</p>
                        <div title={playlist.isPublic ? "Public playlist" : "Private playlist"}>
                          {playlist.isPublic ? (
                            <Globe className="h-3 w-3 text-green-600" />
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <p className="text-caption text-muted-foreground">
                        {playlist.trackIds.length} track{playlist.trackIds.length !== 1 ? 's' : ''} • {duration}
                      </p>
                    </div>
                  </div>
                </Button>
                );
              })
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
