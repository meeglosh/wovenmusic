
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Plus, Library, List } from "lucide-react";
import { Playlist } from "@/types/music";
import { cn } from "@/lib/utils";

interface SidebarProps {
  playlists: Playlist[];
  currentView: "library" | "playlist";
  onViewChange: (view: "library" | "playlist") => void;
  onPlaylistSelect: (playlist: Playlist) => void;
}

const Sidebar = ({ playlists, currentView, onViewChange, onPlaylistSelect }: SidebarProps) => {
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
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1">
            {playlists.map((playlist) => (
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
                      {playlist.trackIds.length} tracks
                    </p>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
};

export default Sidebar;
