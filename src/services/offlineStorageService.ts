import { Track, Playlist } from "@/types/music";

const CACHE_NAME = "wovenmusic-offline-tracks";
const OFFLINE_METADATA_KEY = "offline-tracks-metadata";

export interface OfflineTrack {
  trackId: string;
  downloadedAt: Date;
  fileSize: number;
  url: string;
}

export interface OfflinePlaylist {
  playlistId: string;
  downloadedAt: Date;
  trackIds: string[];
}

class OfflineStorageService {
  private cache: Cache | null = null;

  async init(): Promise<void> {
    if ('caches' in window) {
      this.cache = await caches.open(CACHE_NAME);
    } else {
      throw new Error("Cache API not supported in this browser");
    }
  }

  async downloadTrack(track: Track): Promise<void> {
    if (!this.cache) await this.init();
    
    try {
      // Fetch the audio file
      const response = await fetch(track.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download track: ${response.statusText}`);
      }

      // Store in cache
      await this.cache!.put(this.getTrackCacheKey(track.id), response.clone());

      // Update metadata
      await this.updateOfflineMetadata(track, response);
    } catch (error) {
      console.error('Error downloading track:', error);
      throw error;
    }
  }

  async downloadPlaylist(playlist: Playlist, tracks: Track[]): Promise<void> {
    const playlistTracks = tracks.filter(track => playlist.trackIds.includes(track.id));
    
    // Download all tracks
    const downloadPromises = playlistTracks.map(track => this.downloadTrack(track));
    await Promise.all(downloadPromises);

    // Update playlist metadata
    await this.updatePlaylistMetadata(playlist);
  }

  async isTrackDownloaded(trackId: string): Promise<boolean> {
    if (!this.cache) await this.init();
    
    const response = await this.cache!.match(this.getTrackCacheKey(trackId));
    return !!response;
  }

  async isPlaylistDownloaded(playlist: Playlist): Promise<boolean> {
    const downloadedTracks = await Promise.all(
      playlist.trackIds.map(trackId => this.isTrackDownloaded(trackId))
    );
    return downloadedTracks.every(isDownloaded => isDownloaded);
  }

  async getOfflineTrackUrl(trackId: string): Promise<string | null> {
    if (!this.cache) await this.init();
    
    const response = await this.cache!.match(this.getTrackCacheKey(trackId));
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    return null;
  }

  async removeTrack(trackId: string): Promise<void> {
    if (!this.cache) await this.init();
    
    await this.cache!.delete(this.getTrackCacheKey(trackId));
    await this.removeFromMetadata(trackId);
  }

  async removePlaylist(playlistId: string): Promise<void> {
    const metadata = await this.getOfflineMetadata();
    const playlist = metadata.playlists.find(p => p.playlistId === playlistId);
    
    if (playlist) {
      // Remove all tracks in the playlist
      await Promise.all(playlist.trackIds.map(trackId => this.removeTrack(trackId)));
      
      // Remove playlist metadata
      metadata.playlists = metadata.playlists.filter(p => p.playlistId !== playlistId);
      await this.saveOfflineMetadata(metadata);
    }
  }

  async getDownloadedTracks(): Promise<OfflineTrack[]> {
    const metadata = await this.getOfflineMetadata();
    return metadata.tracks;
  }

  async getDownloadedPlaylists(): Promise<OfflinePlaylist[]> {
    const metadata = await this.getOfflineMetadata();
    return metadata.playlists;
  }

  async getStorageSize(): Promise<number> {
    if (!this.cache) await this.init();
    
    let totalSize = 0;
    const keys = await this.cache!.keys();
    
    for (const request of keys) {
      const response = await this.cache!.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    return totalSize;
  }

  async clearAllOfflineData(): Promise<void> {
    if (!this.cache) await this.init();
    
    await this.cache!.delete(CACHE_NAME);
    localStorage.removeItem(OFFLINE_METADATA_KEY);
    this.cache = await caches.open(CACHE_NAME);
  }

  private getTrackCacheKey(trackId: string): string {
    return `/offline-track/${trackId}`;
  }

  private async updateOfflineMetadata(track: Track, response: Response): Promise<void> {
    const metadata = await this.getOfflineMetadata();
    const blob = await response.blob();
    
    const offlineTrack: OfflineTrack = {
      trackId: track.id,
      downloadedAt: new Date(),
      fileSize: blob.size,
      url: track.fileUrl
    };

    // Remove existing entry if any
    metadata.tracks = metadata.tracks.filter(t => t.trackId !== track.id);
    metadata.tracks.push(offlineTrack);

    await this.saveOfflineMetadata(metadata);
  }

  private async updatePlaylistMetadata(playlist: Playlist): Promise<void> {
    const metadata = await this.getOfflineMetadata();
    
    const offlinePlaylist: OfflinePlaylist = {
      playlistId: playlist.id,
      downloadedAt: new Date(),
      trackIds: playlist.trackIds
    };

    // Remove existing entry if any
    metadata.playlists = metadata.playlists.filter(p => p.playlistId !== playlist.id);
    metadata.playlists.push(offlinePlaylist);

    await this.saveOfflineMetadata(metadata);
  }

  private async removeFromMetadata(trackId: string): Promise<void> {
    const metadata = await this.getOfflineMetadata();
    metadata.tracks = metadata.tracks.filter(t => t.trackId !== trackId);
    
    // Also remove from any playlists that only contained this track
    metadata.playlists = metadata.playlists.filter(playlist => {
      playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
      return playlist.trackIds.length > 0;
    });

    await this.saveOfflineMetadata(metadata);
  }

  private async getOfflineMetadata(): Promise<{ tracks: OfflineTrack[], playlists: OfflinePlaylist[] }> {
    const stored = localStorage.getItem(OFFLINE_METADATA_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      parsed.tracks = parsed.tracks.map((t: any) => ({
        ...t,
        downloadedAt: new Date(t.downloadedAt)
      }));
      parsed.playlists = parsed.playlists.map((p: any) => ({
        ...p,
        downloadedAt: new Date(p.downloadedAt)
      }));
      return parsed;
    }
    return { tracks: [], playlists: [] };
  }

  private async saveOfflineMetadata(metadata: { tracks: OfflineTrack[], playlists: OfflinePlaylist[] }): Promise<void> {
    localStorage.setItem(OFFLINE_METADATA_KEY, JSON.stringify(metadata));
  }
}

export const offlineStorageService = new OfflineStorageService();

// Utility functions for formatting
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isOnline = (): boolean => {
  return navigator.onLine;
};

// New utility to check if running as PWA
export const isPWAMode = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         // @ts-ignore
         window.navigator.standalone === true;
};
