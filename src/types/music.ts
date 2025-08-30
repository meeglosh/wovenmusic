// src/types/music.ts

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** "mm:ss" or "hh:mm:ss" */
  duration: string;

  /**
   * LEGACY ONLY – URL to Supabase public file.
   * New code should ignore this and use resolveTrackUrl(track.id).
   */
  fileUrl?: string | null;

  addedAt: Date;

  // Source/import hints
  source_folder?: string | null;
  dropbox_path?: string | null;

  // Visibility/ownership
  is_public?: boolean;
  play_count?: number;
  created_by?: string | null;

  /**
   * Storage backend type for the audio blob.
   * 'r2' for new files; legacy rows may have undefined and rely on fileUrl.
   */
  storage_type?: 'r2' | 'supabase' | null;

  /** R2 object key, e.g. "tracks/<uuid>.mp3" (present when storage_type === 'r2') */
  storage_key?: string | null;

  /** R2 bucket name that holds the object (optional if you always use default) */
  storage_bucket?: string | null;

  /** MIME type saved at ingest time, e.g. "audio/mpeg" | "audio/mp4" */
  content_type?: string | null;

  /**
   * Optional, if you cached a resolved URL temporarily.
   * Do NOT persist; always prefer backend /api/track-url for fresh playback links.
   */
  storage_url?: string | null;
}

export interface PendingTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  status: 'processing' | 'failed';
  error?: string;
  progress?: number;
}

/** Try to produce a useful display filename from the best available source. */
export const getFileName = (track: Track): string => {
  // 1) Dropbox original (if present)
  if (track.dropbox_path) {
    const name = track.dropbox_path.split('/').pop();
    if (name) return name;
  }

  // 2) R2 key (e.g., "tracks/uuid.mp3") → strip folder
  if (track.storage_key) {
    const name = track.storage_key.split('/').pop();
    if (name) return name;
  }

  // 3) Legacy Supabase URL
  if (track.fileUrl) {
    const name = track.fileUrl.split('/').pop();
    if (name) return name;
  }

  // 4) Fallback to title
  return track.title || 'untitled';
};

/** Remove a timestamp prefix like "1693412345_filename.mp3" → "filename.mp3" */
export const getCleanFileName = (track: Track): string => {
  const fileName = getFileName(track);
  return fileName.replace(/^\d+_/, '');
};

/** Prefer explicit title; otherwise derive a title from the filename (sans extension). */
export const getCleanTitle = (track: Track): string => {
  if (track.title && track.title.trim() && !track.title.includes('gen_random_uuid')) {
    return track.title;
  }
  const cleanFileName = getCleanFileName(track);
  return cleanFileName.replace(/\.[^/.]+$/, '');
};

export interface Playlist {
  id: string;
  name: string;
  artistName?: string | null;
  /** LEGACY: URL to Supabase image */
  imageUrl?: string | null;
  /** R2 key for image, e.g. "images/playlists/<uuid>.jpg" */
  image_key?: string | null;

  trackIds: string[];
  createdAt: Date;
  sharedWith: string[];
  isPublic?: boolean;
  shareToken?: string;

  created_by?: string | null;
  createdByName?: string | null;
}

export interface BandMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Comment {
  id: string;
  trackId: string;
  userId: string;
  content: string;
  timestampSeconds: number;
  createdAt: Date;
  updatedAt: Date;
  userEmail?: string;
  userFullName?: string;
}

// ----------------------- time helpers -----------------------

/** "mm:ss" or "hh:mm:ss" → total seconds */
export const parseDurationToSeconds = (duration: string): number => {
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

/** total seconds → "mm:ss" or "hh:mm:ss" */
export const formatSecondsToDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/** Sum track durations and return a display string */
export const calculatePlaylistDuration = (tracks: Track[]): string => {
  if (tracks.length === 0) return '0:00';
  const totalSeconds = tracks.reduce((acc, t) => acc + parseDurationToSeconds(t.duration), 0);
  return formatSecondsToDuration(totalSeconds);
};
