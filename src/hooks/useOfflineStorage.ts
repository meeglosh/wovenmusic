import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offlineStorageService, OfflineTrack, OfflinePlaylist } from "@/services/offlineStorageService";
import { Track, Playlist } from "@/types/music";
import { toast } from "sonner";

export const useOfflineStorage = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const initService = async () => {
      try {
        await offlineStorageService.init();
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize offline storage:", error);
        toast.error("Offline storage not available in this browser");
      }
    };

    initService();
  }, []);

  const { data: downloadedTracks = [] } = useQuery({
    queryKey: ["offline-tracks"],
    queryFn: () => offlineStorageService.getDownloadedTracks(),
    enabled: isInitialized,
  });

  const { data: downloadedPlaylists = [] } = useQuery({
    queryKey: ["offline-playlists"],
    queryFn: () => offlineStorageService.getDownloadedPlaylists(),
    enabled: isInitialized,
  });

  const { data: storageSize = 0 } = useQuery({
    queryKey: ["offline-storage-size"],
    queryFn: () => offlineStorageService.getStorageSize(),
    enabled: isInitialized,
  });

  const downloadTrackMutation = useMutation({
    mutationFn: async (track: Track) => {
      return offlineStorageService.downloadTrack(track);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["offline-storage-size"] });
      toast.success("Track downloaded for offline playback");
    },
    onError: (error) => {
      console.error("Download failed:", error);
      toast.error("Failed to download track");
    },
  });

  const downloadPlaylistMutation = useMutation({
    mutationFn: async ({ playlist, tracks }: { playlist: Playlist; tracks: Track[] }) => {
      return offlineStorageService.downloadPlaylist(playlist, tracks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["offline-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["offline-storage-size"] });
      toast.success("Playlist downloaded for offline playback");
    },
    onError: (error) => {
      console.error("Playlist download failed:", error);
      toast.error("Failed to download playlist");
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      return offlineStorageService.removeTrack(trackId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["offline-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["offline-storage-size"] });
      toast.success("Track removed from device");
    },
    onError: (error) => {
      console.error("Remove track failed:", error);
      toast.error("Failed to remove track");
    },
  });

  const removePlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      return offlineStorageService.removePlaylist(playlistId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["offline-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["offline-storage-size"] });
      toast.success("Playlist removed from device");
    },
    onError: (error) => {
      console.error("Remove playlist failed:", error);
      toast.error("Failed to remove playlist");
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return offlineStorageService.clearAllOfflineData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["offline-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["offline-storage-size"] });
      toast.success("All offline data cleared");
    },
    onError: (error) => {
      console.error("Clear all failed:", error);
      toast.error("Failed to clear offline data");
    },
  });

  const isTrackDownloaded = (trackId: string): boolean => {
    return downloadedTracks.some(track => track.trackId === trackId);
  };

  const isPlaylistDownloaded = (playlist: Playlist): boolean => {
    return playlist.trackIds.every(trackId => isTrackDownloaded(trackId));
  };

  const getOfflineTrackUrl = async (trackId: string): Promise<string | null> => {
    if (!isInitialized) return null;
    return offlineStorageService.getOfflineTrackUrl(trackId);
  };

  return {
    isInitialized,
    downloadedTracks,
    downloadedPlaylists,
    storageSize,
    isTrackDownloaded,
    isPlaylistDownloaded,
    getOfflineTrackUrl,
    downloadTrack: downloadTrackMutation.mutateAsync,
    downloadPlaylist: downloadPlaylistMutation.mutateAsync,
    removeTrack: removeTrackMutation.mutateAsync,
    removePlaylist: removePlaylistMutation.mutateAsync,
    clearAllOfflineData: clearAllMutation.mutate,
    isDownloading: downloadTrackMutation.isPending || downloadPlaylistMutation.isPending,
    isRemoving: removeTrackMutation.isPending || removePlaylistMutation.isPending,
  };
};
