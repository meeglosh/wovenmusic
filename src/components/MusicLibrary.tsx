
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, MoreHorizontal, Clock, Trash2, X, ChevronDown, ChevronUp, Plus, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Lock, Globe, Settings, Box } from "lucide-react";
import { Track, PendingTrack, getFileName, getCleanFileName, getCleanTitle } from "@/types/music";
import { OfflineDownloadButton } from "@/components/OfflineDownloadButton";
import { DropboxSyncAccordion } from "./DropboxSyncAccordion";
import { DropboxSyncDrawer } from "./DropboxSyncDrawer";
import BulkAddToPlaylistModal from "./BulkAddToPlaylistModal";
import { useDeleteTrack, useBulkDeleteTracks } from "@/hooks/useDeleteTrack";
import { useToast } from "@/hooks/use-toast";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface MusicLibraryProps {
  tracks: Track[];
  onPlayTrack: (track: Track, playlist?: Track[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  searchTerm?: string;
  onTitleChange?: (title: string) => void;
  showDropboxAccordion?: boolean;
  pendingTracks?: PendingTrack[];
  onRetryPendingTrack?: (trackId: string) => void;
  onPendingTracksChange?: (pendingTracks: PendingTrack[]) => void;
}

type SortField = 'title' | 'artist' | 'duration' | 'addedAt';
type SortDirection = 'asc' | 'desc';

const MusicLibrary = ({ tracks, onPlayTrack, currentTrack, isPlaying, searchTerm, onTitleChange, showDropboxAccordion, pendingTracks = [], onRetryPendingTrack, onPendingTracksChange }: MusicLibraryProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Random title and subtitle selection
  const libraryTitles = useMemo(() => [
    { title: "Driftspace", subtitle: "The echo vault of our collected murmurings" },
    { title: "Memory Husk", subtitle: "Where yesterday's thoughts molt quietly" },
    { title: "Whisper Net", subtitle: "Knotted threads of half-remembered signals" },
    { title: "Echo Nest", subtitle: "Built from the twigs of forgotten sounds" },
    { title: "The Pale Index", subtitle: "A ledger of things we almost knew" },
    { title: "Dustloom", subtitle: "Woven from still-breathing artifacts" },
    { title: "Phantom Shelf", subtitle: "Housing the silhouettes of once-held ideas" },
    { title: "Blur Archive", subtitle: "Fragments of clarity, stored without context" },
    { title: "Sleepstack", subtitle: "Where intentions dissolve into form" },
    { title: "Signal Bloom", subtitle: "Archived pulses from the not-yet-now" },
    { title: "Murmurfield", subtitle: "A soft terrain of repeating thoughts" },
    { title: "Corefrost", subtitle: "Ideas frozen mid-thaw" },
    { title: "Hollowgrid", subtitle: "The quiet geometry of forgotten truths" },
    { title: "Wane Ledger", subtitle: "A record of every glow now dimmed" },
    { title: "Vestige Cloud", subtitle: "The drift of all nearly-lost things" },
    { title: "Nulltone", subtitle: "Filed vibrations with no source" },
    { title: "Shedtrace", subtitle: "Remnants of what once compelled us" },
    { title: "Veinpath", subtitle: "Where thoughts echo through silent tunnels" },
    { title: "Sleepprint", subtitle: "The residue of mental wanderings" },
    { title: "Fathom Nest", subtitle: "A holding cell for unsurfaced truths" },
    { title: "Tracewell", subtitle: "The spiral where ideas loop inward" },
    { title: "Glyph Dust", subtitle: "Unspoken marks from invisible tongues" },
    { title: "The Neverstill", subtitle: "Where memory flickers but won't settle" },
    { title: "Memory Wake", subtitle: "Trailing debris from departed certainties" },
    { title: "Cradlebank", subtitle: "Where orphaned notions come to rest" },
    { title: "Thoughtloom", subtitle: "Where forgotten threads weave themselves again" },
    { title: "The Quiet Fold", subtitle: "A pocket of nearly-said things" },
    { title: "Glintstack", subtitle: "Collected flashes from the mind's recess" },
    { title: "Mist Ledger", subtitle: "Soft recordings of dissolved certainties" },
    { title: "The Still Circuit", subtitle: "Where paused ideas hum quietly" },
    { title: "Obscurial", subtitle: "The resting place of half-born patterns" },
    { title: "The Hushed Array", subtitle: "Arranged silences waiting for meaning" },
    { title: "Fogcoil", subtitle: "Memories that loop and never resolve" },
    { title: "Wispbank", subtitle: "Where notions exhale and wait" },
    { title: "The Sleep Spindle", subtitle: "Twisting fragments of once-urgent dreams" },
    { title: "Quasireel", subtitle: "Footage from timelines that never stabilized" },
    { title: "The Murkstack", subtitle: "A layered archive of ambient intentions" },
    { title: "Chronodrift", subtitle: "Collected pieces of time that never fit" },
    { title: "The Shiverhold", subtitle: "Where impulses tremble into form" },
    { title: "Glowchamber", subtitle: "Dim pulses of long-dormant thoughts" },
    { title: "Echoveil", subtitle: "A sheer curtain of recurring murmurs" },
    { title: "Tracewell", subtitle: "A well that fills only with reflections" },
    { title: "Reverie Sink", subtitle: "Where ideas disappear gently, on purpose" },
    { title: "Null Cache", subtitle: "Stored meaning without memory" },
    { title: "The Lattice Fade", subtitle: "Where connections dissolve into silence" },
    { title: "Subthought Vault", subtitle: "Layers beneath the first idea" },
    { title: "The Pale Relay", subtitle: "A signal endlessly handed to no one" },
    { title: "Dust Memory", subtitle: "Imprints that resisted being known" },
    { title: "Neural Flume", subtitle: "Where cognition spirals, unclaimed" },
    { title: "The Untether", subtitle: "Collected floatings never pinned down" }
  ], []);

  const randomLibraryTitle = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * libraryTitles.length);
    return libraryTitles[randomIndex];
  }, [libraryTitles]);

  // Notify parent component when title changes
  useEffect(() => {
    onTitleChange?.(randomLibraryTitle.title);
  }, [randomLibraryTitle.title, onTitleChange]);

  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [isDropboxSyncExpanded, setIsDropboxSyncExpanded] = useState(false);
  const [isDropboxDrawerOpen, setIsDropboxDrawerOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem('musicLibrarySortField');
    return saved ? (saved as SortField) : 'addedAt';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem('musicLibrarySortDirection');
    return saved ? (saved as SortDirection) : 'desc';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const deleteTrackMutation = useDeleteTrack();
  const bulkDeleteMutation = useBulkDeleteTracks();
  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();
  const { canDeleteTrack } = usePermissions();

  // Sort tracks based on current sort settings
  const sortedTracks = [...tracks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'artist':
        comparison = a.artist.localeCompare(b.artist);
        break;
      case 'duration':
        // Handle duration sorting (put --:-- at the end)
        if (a.duration === '--:--' && b.duration !== '--:--') return 1;
        if (b.duration === '--:--' && a.duration !== '--:--') return -1;
        if (a.duration === '--:--' && b.duration === '--:--') return 0;
        
        // Convert duration to seconds for comparison
        const aDuration = a.duration.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
        const bDuration = b.duration.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
        comparison = aDuration - bDuration;
        break;
      case 'addedAt':
        comparison = a.addedAt.getTime() - b.addedAt.getTime();
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedTracks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTracks = sortedTracks.slice(startIndex, endIndex);

  const selectedTracks = sortedTracks.filter(track => selectedTrackIds.has(track.id));
  const deletableSelectedTracks = selectedTracks.filter(track => canDeleteTrack(track));

  const isSelectionMode = selectedTrackIds.size > 0;
  const allCurrentPageSelected = paginatedTracks.length > 0 && paginatedTracks.every(track => selectedTrackIds.has(track.id));
  const someCurrentPageSelected = paginatedTracks.some(track => selectedTrackIds.has(track.id)) && !allCurrentPageSelected;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      localStorage.setItem('musicLibrarySortDirection', newDirection);
    } else {
      setSortField(field);
      setSortDirection('asc');
      localStorage.setItem('musicLibrarySortField', field);
      localStorage.setItem('musicLibrarySortDirection', 'asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };


  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrackIds(new Set(paginatedTracks.map(track => track.id)));
    } else {
      setSelectedTrackIds(new Set());
    }
  };

  const handleSelectTrack = (trackId: string, checked: boolean) => {
    const newSelection = new Set(selectedTrackIds);
    if (checked) {
      newSelection.add(trackId);
    } else {
      newSelection.delete(trackId);
    }
    setSelectedTrackIds(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedTrackIds(new Set());
  };

  const handleDeleteTrack = async (track: Track) => {
    try {
      const result = await deleteTrackMutation.mutateAsync(track.id);
      const isStoredFile = result.isStoredFile;
      
      toast({
        title: "Track removed",
        description: isStoredFile 
          ? `"${track.title}" has been permanently deleted.`
          : `"${track.title}" has been removed from your library. The file remains in your Dropbox.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove track from library.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    const deletableIds = deletableSelectedTracks.map(track => track.id);
    if (deletableIds.length === 0) {
      toast({
        title: "No tracks to delete",
        description: "You don't have permission to delete any of the selected tracks.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const result = await bulkDeleteMutation.mutateAsync(deletableIds);
      setSelectedTrackIds(new Set());
      
      // Create appropriate message based on what was deleted
      let description = "";
      if (result.storedCount > 0 && result.dropboxCount > 0) {
        description = `${result.storedCount} stored file(s) permanently deleted, ${result.dropboxCount} Dropbox file(s) removed from library.`;
      } else if (result.storedCount > 0) {
        description = `${result.storedCount} stored file(s) permanently deleted.`;
      } else {
        description = `${result.dropboxCount} file(s) removed from library. The files remain in your Dropbox.`;
      }
      
      toast({
        title: "Tracks removed",
        description,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove tracks from library.",
        variant: "destructive",
      });
    }
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-primary">{randomLibraryTitle.title}</h2>
          <p className="text-muted-foreground mt-1 font-rem font-thin">{randomLibraryTitle.subtitle}</p>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {tracks.length} result{tracks.length !== 1 ? 's' : ''} for "{searchTerm}"
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
            {totalPages > 1 && (
              <span className="ml-2">
                (page {currentPage} of {totalPages})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dropbox Sync Section - Desktop accordion */}
      {!searchTerm && (
        <Card className="overflow-hidden hidden lg:block">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => {
              setIsDropboxSyncExpanded(!isDropboxSyncExpanded);
            }}
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center">
                <Box className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-primary">Dropbox Sync</h3>
                <p className="text-sm text-muted-foreground">
                  {isDropboxSyncExpanded ? 'Click to collapse' : 'Click to manage your Dropbox connection'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              {isDropboxSyncExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {isDropboxSyncExpanded && (
            <div className="border-t border-border p-4">
              <DropboxSyncAccordion 
                isExpanded={isDropboxSyncExpanded}
                onExpandedChange={setIsDropboxSyncExpanded}
                onPendingTracksChange={onPendingTracksChange}
              />
            </div>
          )}
        </Card>
      )}

      {/* Dropbox Sync Section - Mobile/Tablet button */}
      {!searchTerm && (
        <Card className="overflow-hidden lg:hidden">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setIsDropboxDrawerOpen(true)}
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center">
                <Box className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-primary">Dropbox Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and import music from Dropbox
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Mobile Dropbox Drawer */}
      <DropboxSyncDrawer
        isOpen={isDropboxDrawerOpen}
        onOpenChange={setIsDropboxDrawerOpen}
        onPendingTracksChange={onPendingTracksChange}
      />

      {/* Selection Actions - appears after Dropbox sync */}
      {isSelectionMode && (
        <div className="flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-muted/50 rounded-lg p-4 border">
            <div className="flex flex-col gap-3">
              <span className="text-sm text-muted-foreground text-center">
                 {selectedTrackIds.size} selected
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsBulkAddModalOpen(true)}
                  className="flex-1 min-h-[40px]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Playlist
                </Button>
                {deletableSelectedTracks.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={bulkDeleteMutation.isPending}
                        className="flex-1 min-h-[40px]"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove {deletableSelectedTracks.length > 0 ? `${deletableSelectedTracks.length} ` : ''}Selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove selected tracks?</AlertDialogTitle>
                         <AlertDialogDescription>
                           Are you sure you want to remove {deletableSelectedTracks.length} track{deletableSelectedTracks.length !== 1 ? 's' : ''} from your library?
                           {selectedTrackIds.size > deletableSelectedTracks.length && 
                             ` (${selectedTrackIds.size - deletableSelectedTracks.length} track${selectedTrackIds.size - deletableSelectedTracks.length !== 1 ? 's' : ''} will be skipped due to permissions)`
                           }
                           Uploaded files will be permanently deleted, while Dropbox files will remain in your Dropbox.
                         </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove {deletableSelectedTracks.length} track{deletableSelectedTracks.length !== 1 ? 's' : ''}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="text-primary min-h-[40px]"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dropbox Sync Section */}

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <div className="text-2xl text-primary/60">♪</div>
            </div>
            {searchTerm ? (
              <>
                <h3 className="text-xl font-semibold mb-2 text-primary">No tracks found</h3>
                <p className="text-muted-foreground mb-4">No tracks match your search for "{searchTerm}".</p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-2 text-primary">No tracks yet</h3>
                <p className="text-muted-foreground mb-4">Connect your Dropbox to sync your music library automatically.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[auto,auto,1fr,auto,auto,auto,auto] gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="w-8">
              <Checkbox
                checked={allCurrentPageSelected}
                onCheckedChange={handleSelectAll}
                className={someCurrentPageSelected ? 'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground' : ''}
                data-indeterminate={someCurrentPageSelected}
              />
            </div>
            <div className="w-12"></div>
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('title')}
                className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
              >
                Title {getSortIcon('title')}
              </Button>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('duration')}
                className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
              >
                <Clock className="w-4 h-4 mr-1" />
                {getSortIcon('duration')}
              </Button>
            </div>
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('addedAt')}
                className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
              >
                Added {getSortIcon('addedAt')}
              </Button>
            </div>
            <div className="w-8"></div>
            <div className="w-12"></div>
          </div>

          <div className="divide-y divide-border">
            {paginatedTracks.map((track, index) => (
              <div
                key={track.id}
                className={`grid items-center gap-x-3 p-3 md:p-4 hover:bg-muted/30 transition-colors group
                  grid-cols-[2rem,1.25rem,minmax(0,1fr),3.5rem,1.75rem,1.75rem]
                  sm:grid-cols-[2rem,1.25rem,minmax(0,1fr),3.5rem,1.75rem,1.75rem,1.75rem]
                  md:grid-cols-[auto,auto,1fr,auto,auto,auto,auto] md:gap-4
                  min-h-[3.5rem] sm:min-h-0 ${
                  selectedTrackIds.has(track.id) ? 'bg-muted/50' : ''
                }`}
              >
                {/* Checkbox */}
                <div className="w-8 justify-self-center">
                  <Checkbox
                    checked={selectedTrackIds.has(track.id)}
                    onCheckedChange={(checked) => handleSelectTrack(track.id, checked as boolean)}
                  />
                </div>

                {/* Play/Pause Button */}
                <div className="w-10 h-10 justify-self-center flex items-center justify-center">
                  {track.duration === 'Transcoding...' ? (
                    // Show nothing during transcoding
                    null
                  ) : currentTrack?.id === track.id && isPlaying ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-10 h-10 p-0 transition-all hover:bg-accent hover:text-foreground active:bg-accent active:text-background rounded-full ${
                        isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={() => onPlayTrack(track)}
                      title="Pause track"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-10 h-10 p-0 transition-all hover:bg-accent hover:text-foreground active:bg-accent active:text-background rounded-full ${
                        track.duration === 'Failed' ? 'cursor-not-allowed opacity-50' : ''
                      } ${
                        isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={() => onPlayTrack(track)}
                      disabled={track.duration === 'Failed'}
                      title={track.duration === 'Failed' ? 'Transcoding failed' : 'Play track'}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </Button>
                  )}
                  <span className={`text-muted-foreground text-sm transition-opacity absolute ${
                    isMobile ? 'opacity-0' : 'group-hover:opacity-0'
                  }`}>
                    {startIndex + index + 1}
                  </span>
                </div>

                {/* Title */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20 hidden md:flex">
                    <div className="flex space-x-px">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary/60 wave-bar rounded-full"
                          style={{ height: `${Math.random() * 16 + 4}px` }}
                        />
                      ))}
                    </div>
                  </div>
                  <button 
                    className={`text-left font-medium hover:text-primary transition-colors cursor-pointer 
                      line-clamp-2 whitespace-normal break-words hyphens-auto
                      sm:truncate sm:whitespace-nowrap sm:overflow-hidden sm:line-clamp-1 ${
                      track.duration === 'Transcoding...' ? 'opacity-50' : ''
                    }`}
                    onClick={() => navigate(`/track/${track.id}`)}
                    title="Open track view with comments"
                  >
                    {track.title}
                  </button>
                </div>

                {/* Duration */}
                <div className="w-[3.5rem] text-right tabular-nums text-muted-foreground text-sm md:text-base self-center">
                  {track.duration === 'Transcoding...' ? (
                    <div className="flex items-center justify-end space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </div>
                  ) : track.duration === 'Failed' ? (
                    <span className="text-destructive text-xs">Fail</span>
                  ) : (
                    <span className="text-xs md:text-sm">{track.duration}</span>
                  )}
                </div>

                <div className="hidden md:flex items-center text-xs md:text-sm text-muted-foreground">
                  <span className="truncate">{track.addedAt.toLocaleDateString()}</span>
                </div>

                {/* Privacy Icon */}
                <div className="w-7 justify-self-center hidden sm:block" title={track.is_public ? "Public track" : "Private track"}>
                  {track.is_public ? (
                    <Globe className="h-3 w-3 text-green-600" />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>

                {/* Download Button */}
                <div className="w-7 justify-self-center self-center">
                  <OfflineDownloadButton 
                    track={track}
                    variant="ghost"
                    size="icon"
                    className={`w-7 h-7 transition-opacity ${
                      isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </div>

                {/* More Menu */}
                <div className="w-7 justify-self-center self-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`w-7 h-7 p-0 transition-opacity ${
                          isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canDeleteTrack(track) ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove from library
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove track from library?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{track.title}" from your library?
                                {track.fileUrl ? 'This will permanently delete the uploaded file.' : 'The file will remain in your Dropbox.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTrack(track)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove from library
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <DropdownMenuItem disabled>
                          <Settings className="w-4 h-4 mr-2" />
                          No actions available
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            
            {/* Render pending tracks only on first page */}
            {currentPage === 1 && pendingTracks.map((pendingTrack) => (
              <div
                key={pendingTrack.id}
                className="grid grid-cols-[auto,auto,1fr,auto,auto,auto,auto] gap-4 p-4 bg-muted/20 transition-colors"
              >
                <div className="w-8 flex items-center">
                  {/* No checkbox for pending tracks */}
                </div>
                <div className="w-12 flex items-center">
                  {pendingTrack.status === 'processing' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-destructive" />
                  )}
                  <span className="text-muted-foreground text-sm opacity-50">
                    --
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded flex items-center justify-center border border-primary/10 hidden md:flex">
                    <div className="flex space-x-px opacity-50">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary/30 rounded-full"
                          style={{ height: `${Math.random() * 16 + 4}px` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div>
                      <div className="text-left font-medium text-muted-foreground">
                        {pendingTrack.title.replace(/\.[^/.]+$/, '')} {/* Remove file extension */}
                      </div>
                      <div className="text-sm text-muted-foreground opacity-75 flex items-center space-x-2">
                        {pendingTrack.artist}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center text-muted-foreground">
                  {pendingTrack.status === 'processing' ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-primary">Processing...</span>
                      {pendingTrack.progress && (
                        <span className="text-xs opacity-75">({pendingTrack.progress}%)</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-destructive text-sm">Failed</span>
                      {onRetryPendingTrack && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRetryPendingTrack(pendingTrack.id)}
                          className="h-6 text-xs"
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center text-sm text-muted-foreground opacity-50">
                  --
                </div>

                <div className="w-8 flex items-center justify-center">
                  <Lock className="h-3 w-3 text-muted-foreground opacity-50" />
                </div>

                <div className="w-12 flex items-center">
                  {/* No actions for pending tracks */}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center px-4">
          <Pagination className="w-full">
            <PaginationContent className="flex flex-wrap justify-center gap-1 sm:gap-2">
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1);
                      setSelectedTrackIds(new Set()); // Clear selection when changing pages
                    }
                  }}
                  className={`${currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} text-xs sm:text-sm`}
                />
              </PaginationItem>
              
              {/* First page */}
              {currentPage > 3 && (
                <>
                  <PaginationItem>
                    <PaginationLink 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(1);
                        setSelectedTrackIds(new Set());
                      }}
                      className="cursor-pointer text-xs sm:text-sm"
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                  {currentPage > 4 && (
                    <PaginationItem className="hidden sm:block">
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                </>
              )}
              
              {/* Pages around current page - show fewer on mobile */}
              {Array.from({ length: Math.min(isMobile ? 3 : 5, totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, Math.min(totalPages - (isMobile ? 2 : 4), currentPage - (isMobile ? 1 : 2))) + i;
                if (pageNumber > totalPages) return null;
                
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(pageNumber);
                        setSelectedTrackIds(new Set());
                      }}
                      isActive={currentPage === pageNumber}
                      className="cursor-pointer text-xs sm:text-sm min-w-[32px] h-8 sm:h-9"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              {/* Last page */}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && (
                    <PaginationItem className="hidden sm:block">
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(totalPages);
                        setSelectedTrackIds(new Set());
                      }}
                      className="cursor-pointer text-xs sm:text-sm"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                </>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1);
                      setSelectedTrackIds(new Set()); // Clear selection when changing pages
                    }
                  }}
                  className={`${currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} text-xs sm:text-sm`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Bulk Add to Playlist Modal */}
      <BulkAddToPlaylistModal
        open={isBulkAddModalOpen}
        onOpenChange={setIsBulkAddModalOpen}
        selectedTracks={selectedTracks}
      />
    </div>
  );
};

export default MusicLibrary;
