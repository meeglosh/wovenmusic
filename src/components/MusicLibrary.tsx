
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, MoreHorizontal, Clock, Trash2, X, ChevronDown, ChevronUp, Plus, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Lock, Globe, Settings, Box } from "lucide-react";
import { Track, getFileName } from "@/types/music";
import { DropboxSyncAccordion } from "./DropboxSyncAccordion";
import BulkAddToPlaylistModal from "./BulkAddToPlaylistModal";
import { useDeleteTrack, useBulkDeleteTracks } from "@/hooks/useDeleteTrack";
import { useToast } from "@/hooks/use-toast";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useIsMobile } from "@/hooks/use-mobile";
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

interface MusicLibraryProps {
  tracks: Track[];
  onPlayTrack: (track: Track, playlist?: Track[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  searchTerm?: string;
  onTitleChange?: (title: string) => void;
  showDropboxAccordion?: boolean;
}

type SortField = 'title' | 'artist' | 'duration' | 'addedAt';
type SortDirection = 'asc' | 'desc';

const MusicLibrary = ({ tracks, onPlayTrack, currentTrack, isPlaying, searchTerm, onTitleChange, showDropboxAccordion }: MusicLibraryProps) => {
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
  const [isDropboxSyncExpanded, setIsDropboxSyncExpanded] = useState(true);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('addedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [calculatingDurations, setCalculatingDurations] = useState<Set<string>>(new Set());
  const deleteTrackMutation = useDeleteTrack();
  const bulkDeleteMutation = useBulkDeleteTracks();
  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();

  // Sort tracks based on current sort settings
  const sortedTracks = [...tracks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'title':
        comparison = getFileName(a).localeCompare(getFileName(b));
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

  const selectedTracks = sortedTracks.filter(track => selectedTrackIds.has(track.id));

  const isSelectionMode = selectedTrackIds.size > 0;
  const allTracksSelected = tracks.length > 0 && selectedTrackIds.size === tracks.length;
  const someTracksSelected = selectedTrackIds.size > 0 && selectedTrackIds.size < tracks.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const calculateDuration = async (track: Track) => {
    if (!track.fileUrl || track.fileUrl === '#' || calculatingDurations.has(track.id)) return;
    
    setCalculatingDurations(prev => new Set([...prev, track.id]));
    
    try {
      const audio = new Audio();
      const promise = new Promise<number>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', reject);
      });
      
      audio.src = track.fileUrl;
      const duration = await promise;
      
      if (duration && !isNaN(duration)) {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        await updateTrackMutation.mutateAsync({
          id: track.id,
          updates: { duration: formattedDuration }
        });
      }
    } catch (error) {
      console.error('Failed to calculate duration for track:', track.title, error);
    } finally {
      setCalculatingDurations(prev => {
        const newSet = new Set(prev);
        newSet.delete(track.id);
        return newSet;
      });
    }
  };

  // Auto-calculate durations for tracks with --:-- duration
  useEffect(() => {
    const tracksNeedingDuration = tracks.filter(track => 
      track.duration === '--:--' && 
      track.fileUrl && 
      track.fileUrl !== '#' &&
      !calculatingDurations.has(track.id)
    );
    
    // Calculate durations one at a time to avoid overwhelming the browser
    if (tracksNeedingDuration.length > 0) {
      const track = tracksNeedingDuration[0];
      calculateDuration(track);
    }
  }, [tracks, calculatingDurations]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrackIds(new Set(tracks.map(track => track.id)));
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
      const isUploadedFile = result.isUploadedFile;
      
      toast({
        title: "Track removed",
        description: isUploadedFile 
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
    const selectedIds = Array.from(selectedTrackIds);
    try {
      const result = await bulkDeleteMutation.mutateAsync(selectedIds);
      setSelectedTrackIds(new Set());
      
      // Create appropriate message based on what was deleted
      let description = "";
      if (result.uploadedCount > 0 && result.dropboxCount > 0) {
        description = `${result.uploadedCount} uploaded file(s) permanently deleted, ${result.dropboxCount} Dropbox file(s) removed from library.`;
      } else if (result.uploadedCount > 0) {
        description = `${result.uploadedCount} uploaded file(s) permanently deleted.`;
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
          {isSelectionMode && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                 {selectedTrackIds.size} selected
               </span>
               <Button
                 variant="default"
                 size="sm"
                 onClick={() => setIsBulkAddModalOpen(true)}
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Add to Playlist
               </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove selected tracks?</AlertDialogTitle>
                     <AlertDialogDescription>
                       Are you sure you want to remove {selectedTrackIds.size} track{selectedTrackIds.size !== 1 ? 's' : ''} from your library?
                       Uploaded files will be permanently deleted, while Dropbox files will remain in your Dropbox.
                     </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove {selectedTrackIds.size} track{selectedTrackIds.size !== 1 ? 's' : ''}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="text-primary"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Selection
              </Button>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Collapsible Dropbox Sync Section - Hidden during search and on mobile */}
      {!searchTerm && (
        <Card className="overflow-hidden hidden sm:block">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setIsDropboxSyncExpanded(!isDropboxSyncExpanded)}
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
                onExpandedChange={(expanded) => {
                  setIsDropboxSyncExpanded(expanded);
                }} 
              />
            </div>
          )}
        </Card>
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
                checked={allTracksSelected}
                onCheckedChange={handleSelectAll}
                className={someTracksSelected ? 'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground' : ''}
                data-indeterminate={someTracksSelected}
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
            {sortedTracks.map((track, index) => (
              <div
                key={track.id}
                className={`grid grid-cols-[auto,auto,1fr,auto,auto,auto,auto] gap-4 p-4 hover:bg-muted/30 transition-colors group ${
                  selectedTrackIds.has(track.id) ? 'bg-muted/50' : ''
                }`}
              >
                <div className="w-8 flex items-center">
                  <Checkbox
                    checked={selectedTrackIds.has(track.id)}
                    onCheckedChange={(checked) => handleSelectTrack(track.id, checked as boolean)}
                  />
                </div>
                <div className="w-12 flex items-center">
                  {/* Show play/pause button based on current track and playing state */}
                  {track.duration === 'Transcoding...' ? (
                    // Show nothing during transcoding
                    null
                  ) : currentTrack?.id === track.id && isPlaying ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-8 h-8 p-0 transition-all hover:border hover:border-primary rounded-full ${
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
                      className={`w-8 h-8 p-0 transition-all hover:border hover:border-primary rounded-full ${
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
                  <span className={`text-muted-foreground text-sm transition-opacity ${
                    isMobile ? 'opacity-0' : 'group-hover:opacity-0'
                  }`}>
                    {index + 1}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded flex items-center justify-center border border-primary/20">
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
                  <div className="flex items-center space-x-2">
                    <div>
                      <button 
                        className={`text-left font-medium hover:text-primary transition-colors cursor-pointer ${
                          track.duration === 'Transcoding...' ? 'opacity-50' : ''
                        }`}
                        onClick={() => navigate(`/track/${track.id}`)}
                        title="Open track view with comments"
                      >
                        {getFileName(track)}
                      </button>
                      <p className="text-sm text-muted-foreground">{track.artist}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center text-muted-foreground">
                  {track.duration === 'Transcoding...' ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Transcoding...</span>
                    </div>
                  ) : track.duration === 'Failed' ? (
                    <span className="text-destructive text-sm">Failed</span>
                  ) : calculatingDurations.has(track.id) ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Calculating...</span>
                    </div>
                  ) : (
                    track.duration
                  )}
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  {track.addedAt.toLocaleDateString()}
                </div>

                <div className="w-8 flex items-center justify-center" title={track.is_public ? "Public track" : "Private track"}>
                  {track.is_public ? (
                    <Globe className="h-3 w-3 text-green-600" />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>

                <div className="w-12 flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`w-8 h-8 p-0 transition-opacity ${
                          isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                              Are you sure you want to remove "{getFileName(track)}" from your library?
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
