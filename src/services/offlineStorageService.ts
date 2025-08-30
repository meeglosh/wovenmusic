import { Track, Playlist } from "@/types/music";
import { dropboxService } from "@/services/dropboxService";
import { resolveTrackUrl } from "@/services/trackUrls";

const CACHE_NAME = "wovenmusic-offline-tracks";
const OFFLINE_METADATA_KEY = "offline-tracks-metadata";

export interface OfflineTrack {
  trackId: string;
  downloadedAt: Date;
  fileSize: number;
  url: string; // effective URL used at download-time (may be signed / temp)
}

export interface OfflinePlaylist {
  playlistId: string;
  downloadedAt: Date;
  trackIds: string[];
}

class OfflineStorageService {
  private cache: Cache | null = null;

  async init(): Promise<void> {
    if ("caches" in window) {
      this.cache = await caches.open(CACHE_NAME);
    } else {
      throw new Error("Cache API not supported in this browser");
    }
  }

  /**
   * Resolve a playable/downloadable URL for a track, handling:
   * - R2 public (storage_url)
   * - R2 private (signed via edge function)
   * - Legacy Supabase (fileUrl)
   * - Dropbox path (temporary link; requires Dropbox auth)
   */
  private async resolveTrackDownloadUrl(track: Track): Promise<string> {
    // Prefer R2 if present
    if (track.storage_type === "r2") {
      if (track.is_public && track.storage_url) {
        return track.storage_url;
      }
      if (track.storage_key) {
        // Private R2: get signed URL via edge function
        const signed = await resolveTrackUrl(track.id);
        if (!signed) throw new Error("Failed to resolve signed R2 URL");
        return signed;
      }
    }

    // Legacy / Supabase storage
    if (track.fileUrl && track.fileUrl !== "#") {
      return track.fileUrl;
    }

    // Dropbox fallback
    if (track.dropbox_path) {
      if (!dropboxService.isAuthenticated()) {
        throw new Error("DROPBOX_AUTH_REQUIRED");
      }
      return await dropboxService.getTemporaryLink(track.dropbox_path);
    }

    throw new Error("No downloadable source for this track");
  }

  async downloadTrack(track: Track): Promise<void> {
    if (!this.cache) await this.init();
    if (!isOnline()) throw new Error("You appear to be offline");

    try {
      const effectiveUrl = await this.resolveTrackDownloadUrl(track);

      // Fetch the audio file (CORS must be allowed by the source)
      const response = await fetch(effectiveUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`Failed to download track: ${response.status} ${response.statusText}`);
      }

      // Store in cache under a canonical cache key
      await this.cache.put(this.getTrackCacheKey(track.id), response.clone());

      // Update metadata using the effective URL actually fetched
      await this.updateOfflineMetadata(track, response, effectiveUrl);
    } catch (error) {
      console.error("Error downloading track:", error);
      throw error;
    }
  }

  async downloadPlaylist(playlist: Playlist, tracks: Track[]): Promise<void> {
    const playlistTracks = tracks.filter((track) => playlist.trackIds.includes(track.id));

    // Download sequentially to be gentle on network; parallel is fine too
    for (const t of playlistTracks) {
      await this.downloadTrack(t);
    }

    // Update playlist metadata
    await this.updatePlaylistMetadata(playlist);
  }

  async isTrackDownloaded(trackId: string): Promise<boolean> {
    if (!this.cache) await this.init();

    const response = await this.cache.match(this.getTrackCacheKey(trackId));
    return !!response;
  }

  async isPlaylistDownloaded(playlist: Playlist): Promise<boolean> {
    const downloadedTracks = await Promise.all(
      playlist.trackIds.map((trackId) => this.isTrackDownloaded(trackId))
    );
    return downloadedTracks.every((isDownloaded) => isDownloaded);
  }

  /**
   * Returns a blob URL for the cached track, or null if not cached/invalid.
   * Caller is responsible for revoking the object URL when done.
   */
  async getOfflineTrackUrl(trackId: string): Promise<string | null> {
    if (!this.cache) await this.init();

    const response = await this.cache.match(this.getTrackCacheKey(trackId));
    if (response) {
      try {
        const blob = await response.blob();
        if (blob.size > 0) {
          return URL.createObjectURL(blob);
        }
        console.warn(`Invalid blob for track ${trackId}, removing from cache`);
        await this.removeTrack(trackId);
        return null;
      } catch (err) {
        console.warn(`Failed to read blob for track ${trackId}, removing from cache`, err);
        await this.removeTrack(trackId);
        return null;
      }
    }
    return null;
  }

  async removeTrack(trackId: string): Promise<void> {
    if (!this.cache) await this.init();

    await this.cache.delete(this.getTrackCacheKey(trackId));
    await this.removeFromMetadata(trackId);
  }

  async removePlaylist(playlistId: string): Promise<void> {
    const metadata = await this.getOfflineMetadata();
    const playlist = metadata.playlists.find((p) => p.playlistId === playlistId);

    if (playlist) {
      // Remove all tracks in the playlist
      await Promise.all(playlist.trackIds.map((trackId) => this.removeTrack(trackId)));

      // Remove playlist metadata
      metadata.playlists = metadata.playlists.filter((p) => p.playlistId !== playlistId);
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
    const keys = await this.cache.keys();

    for (const request of keys) {
      const response = await this.cache.match(request);
      if (response) {
        try {
          const blob = await response.blob();
          totalSize += blob.size || 0;
        } catch {
          // Opaque/failed reads: size unknown; treat as 0
          totalSize += 0;
        }
      }
    }

    return totalSize;
  }

  async clearAllOfflineData(): Promise<void> {
    // Properly delete the named cache (previously used cache.delete which deletes a Request)
    await caches.delete(CACHE_NAME);
    localStorage.removeItem(OFFLINE_METADATA_KEY);
    // Re-open a fresh cache for future use
    this.cache = await caches.open(CACHE_NAME);
  }

  private getTrackCacheKey(trackId: string): string {
    // This path can also be intercepted by a Service Worker if you add one later
    return `/offline-track/${trackId}`;
  }

  private async updateOfflineMetadata(
    track: Track,
    response: Response,
    effectiveUrl: string
  ): Promise<void> {
    const metadata = await this.getOfflineMetadata();

    let size = 0;
    try {
      const blob = await response.blob();
      size = blob.size || 0;
    } catch {
      size = 0; // Opaque/no body
    }

    const offlineTrack: OfflineTrack = {
      trackId: track.id,
      downloadedAt: new Date(),
      fileSize: size,
      url: effectiveUrl,
    };

    // Remove existing entry if any
    metadata.tracks = metadata.tracks.filter((t) => t.trackId !== track.id);
    metadata.tracks.push(offlineTrack);

    await this.saveOfflineMetadata(metadata);
  }

  private async updatePlaylistMetadata(playlist: Playlist): Promise<void> {
    const metadata = await this.getOfflineMetadata();

    const offlinePlaylist: OfflinePlaylist = {
      playlistId: playlist.id,
      downloadedAt: new Date(),
      trackIds: playlist.trackIds,
    };

    // Remove existing entry if any
    metadata.playlists = metadata.playlists.filter((p) => p.playlistId !== playlist.id);
    metadata.playlists.push(offlinePlaylist);

    await this.saveOfflineMetadata(metadata);
  }

  private async removeFromMetadata(trackId: string): Promise<void> {
    const metadata = await this.getOfflineMetadata();
    metadata.tracks = metadata.tracks.filter((t) => t.trackId !== trackId);

    // Also remove from any playlists and drop empty ones
    metadata.playlists = metadata.playlists
      .map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId),
      }))
      .filter((p) => p.trackIds.length > 0);

    await this.saveOfflineMetadata(metadata);
  }

  private async getOfflineMetadata(): Promise<{ tracks: OfflineTrack[]; playlists: OfflinePlaylist[] }> {
    const stored = localStorage.getItem(OFFLINE_METADATA_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      parsed.tracks = (parsed.tracks || []).map((t: any) => ({
        ...t,
        downloadedAt: new Date(t.downloadedAt),
      }));
      parsed.playlists = (parsed.playlists || []).map((p: any) => ({
        ...p,
        downloadedAt: new Date(p.downloadedAt),
      }));
      return parsed;
    }
    return { tracks: [], playlists: [] };
  }

  private async saveOfflineMetadata(metadata: { tracks: OfflineTrack[]; playlists: OfflinePlaylist[] }): Promise<void> {
    localStorage.setItem(OFFLINE_METADATA_KEY, JSON.stringify(metadata));
  }
}

export const offlineStorageService = new OfflineStorageService();

// Utility functions for formatting
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const isOnline = (): boolean => {
  return navigator.onLine;
};

// New utility to check if running as PWA
export const isPWAMode = (): boolean => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // @ts-ignore
    window.navigator.standalone === true
  );
};
