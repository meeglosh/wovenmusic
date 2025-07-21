import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Music, ListMusic, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Playlist } from "@/types/music";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  playlists: Playlist[];
  currentView: "library" | "playlist";
  onViewChange: (view: "library" | "playlist") => void;
  onPlaylistSelect: (playlist: Playlist) => void;
  libraryTitle?: string;
  selectedPlaylist?: Playlist | null;
}

const MobileNav = ({ playlists, currentView, onViewChange, onPlaylistSelect, libraryTitle = "Driftspace", selectedPlaylist }: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleViewChange = (view: "library" | "playlist") => {
    onViewChange(view);
    setIsOpen(false);
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    onPlaylistSelect(playlist);
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="p-2 text-primary">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 sm:w-96">
          <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  placeholder="Search tracks, playlists..." 
                  className="pl-10 bg-muted/30 border-muted"
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto">
              <div className="p-4 space-y-4">
                {/* Library */}
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    currentView === "library" && "bg-primary/50"
                  )}
                  onClick={() => handleViewChange("library")}
                >
                  <Music className="w-4 h-4 mr-3 text-primary" />
                  <span className="text-base font-semibold text-primary">{libraryTitle}</span>
                </Button>

                {/* Playlists */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground px-3">
                      Playlists
                    </h3>
                  </div>
                  {playlists.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-3 py-2">
                      No playlists yet
                    </p>
                  ) : (
                     <div className="space-y-1">
                       {playlists.map((playlist) => {
                         const isSelected = currentView === "playlist" && selectedPlaylist?.id === playlist.id;
                         return (
                             <Button
                               key={playlist.id}
                               variant="ghost"
                               className={cn(
                                 "w-full justify-start text-left",
                                 isSelected && "bg-primary/50"
                               )}
                               onClick={() => handlePlaylistSelect(playlist)}
                             >
                              <ListMusic className="w-4 h-4 mr-3 flex-shrink-0 text-primary" />
                              <span className="truncate text-base font-semibold text-primary">{playlist.name}</span>
                            </Button>
                         );
                       })}
                     </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileNav;