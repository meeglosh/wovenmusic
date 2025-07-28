
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Music, Plus, Library, List, Lock, Globe } from "lucide-react";
import { Playlist, calculatePlaylistDuration } from "@/types/music";
import { cn } from "@/lib/utils";
import CreatePlaylistModal from "./CreatePlaylistModal";
import { usePlaylistCategories, usePlaylistCategoryLinks } from "@/hooks/usePlaylistCategories";

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
  
  // Fetch categories and category links
  const { data: categories = [] } = usePlaylistCategories();
  const { data: categoryLinks = [] } = usePlaylistCategoryLinks();
  
  // Get expanded categories from localStorage, default to all expanded
  const [expandedCategories, setExpandedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('expanded-categories');
    return saved ? JSON.parse(saved) : categories.map(c => c.id).concat(['unsorted']);
  });
  
  // Save expanded state to localStorage
  const updateExpandedCategories = (value: string[]) => {
    setExpandedCategories(value);
    localStorage.setItem('expanded-categories', JSON.stringify(value));
  };
  
  // Group playlists by category
  const playlistsByCategory = useMemo(() => {
    const categoryMap = new Map<string, Playlist[]>();
    const unsortedPlaylists: Playlist[] = [];
    
    // Initialize categories
    categories.forEach(category => {
      categoryMap.set(category.id, []);
    });
    
    // Group playlists
    playlists.forEach(playlist => {
      const playlistLinks = categoryLinks.filter(link => link.playlist_id === playlist.id);
      
      if (playlistLinks.length === 0) {
        // No category assigned
        unsortedPlaylists.push(playlist);
      } else {
        // Add to each assigned category
        playlistLinks.forEach(link => {
          const categoryPlaylists = categoryMap.get(link.category_id) || [];
          categoryPlaylists.push(playlist);
          categoryMap.set(link.category_id, categoryPlaylists);
        });
      }
    });
    
    return { categoryMap, unsortedPlaylists };
  }, [playlists, categoryLinks, categories]);
  
  const renderPlaylist = (playlist: Playlist) => {
    const isSelected = currentView === "playlist" && selectedPlaylist?.id === playlist.id;
    const playlistTracks = tracks.filter(track => playlist.trackIds.includes(track.id));
    const duration = calculatePlaylistDuration(playlistTracks);
    
    return (
      <Button
        key={playlist.id}
        variant={isSelected ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start h-auto p-3 text-left mb-1",
          "hover:bg-primary/50 transition-colors",
          isSelected && "bg-primary/50"
        )}
        onClick={() => onPlaylistSelect(playlist)}
      >
        <div className="flex items-center w-full">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
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
              <p className="text-base font-semibold text-primary break-words whitespace-normal leading-tight">{playlist.name}</p>
              <p className="text-xs text-muted-foreground">
                {playlist.trackIds.length} track{playlist.trackIds.length !== 1 ? 's' : ''} • {duration}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 ml-2" title={playlist.isPublic ? "Public playlist" : "Private playlist"}>
            {playlist.isPublic ? (
              <Globe className="h-3 w-3 text-green-600" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </Button>
    );
  };
  return (
    <aside className="w-full h-full bg-card/30 border-r border-border flex flex-col">
      <div className="p-4">
        <nav className="space-y-2">
          <Button
            variant={currentView === "library" ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start",
              currentView === "library" && "bg-primary/50"
            )}
            onClick={() => onViewChange("library")}
          >
            <Library className="w-4 h-4 mr-3 text-primary" />
            <span className="text-base font-semibold text-primary">{libraryTitle}</span>
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
            <Plus className="w-4 h-4 text-primary" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-200px)]">
          {playlists.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
                <List className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No playlists yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first playlist</p>
            </div>
          ) : (
            <Accordion 
              type="multiple" 
              value={expandedCategories} 
              onValueChange={updateExpandedCategories}
              className="w-full"
            >
              {/* Category sections */}
              {categories.map(category => {
                const categoryPlaylists = playlistsByCategory.categoryMap.get(category.id) || [];
                if (categoryPlaylists.length === 0) return null;
                
                return (
                  <AccordionItem key={category.id} value={category.id} className="border-none">
                    <AccordionTrigger className="py-2 px-0 text-sm font-medium text-muted-foreground hover:no-underline hover:text-primary transition-colors">
                      {category.name} ({categoryPlaylists.length})
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="space-y-1">
                        {categoryPlaylists.map(renderPlaylist)}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              
              {/* Unsorted playlists section */}
              {playlistsByCategory.unsortedPlaylists.length > 0 && (
                <AccordionItem value="unsorted" className="border-none">
                  <AccordionTrigger className="py-2 px-0 text-sm font-medium text-muted-foreground hover:no-underline hover:text-primary transition-colors">
                    Unsorted murmur ({playlistsByCategory.unsortedPlaylists.length})
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="space-y-1">
                      {playlistsByCategory.unsortedPlaylists.map(renderPlaylist)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          )}
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
