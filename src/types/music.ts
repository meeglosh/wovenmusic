
export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  fileUrl: string;
  addedAt: Date;
  source_folder?: string;
  dropbox_path?: string;
  is_public?: boolean;
  play_count?: number;
  created_by?: string;
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

// Utility function to get the full filename from a track
export const getFileName = (track: Track): string => {
  // Try to get the filename from dropbox_path first, then fileUrl
  const filePath = track.dropbox_path || track.fileUrl || '';
  // Extract just the filename from the full path
  const fileName = filePath.split('/').pop() || track.title;
  return fileName;
};

// Utility function to get clean display filename by stripping timestamp prefix
export const getCleanFileName = (track: Track): string => {
  const fileName = getFileName(track);
  // Strip timestamp prefix pattern (digits followed by underscore)
  const cleanName = fileName.replace(/^\d+_/, '');
  return cleanName;
};

// Utility function to extract clean title from filename (without extension)
export const getCleanTitle = (track: Track): string => {
  // If we have a proper title from the database, use that
  if (track.title && track.title.trim() && !track.title.includes('gen_random_uuid')) {
    return track.title;
  }
  
  // Fallback to extracting from filename
  const cleanFileName = getCleanFileName(track);
  // Remove file extension for title display
  return cleanFileName.replace(/\.[^/.]+$/, '');
};

export interface Playlist {
  id: string;
  name: string;
  imageUrl?: string;
  trackIds: string[];
  createdAt: Date;
  sharedWith: string[];
  isPublic?: boolean;
  shareToken?: string;
  created_by?: string;
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

// Utility function to parse duration string (mm:ss or hh:mm:ss) to total seconds
export const parseDurationToSeconds = (duration: string): number => {
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    // mm:ss format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // hh:mm:ss format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

// Utility function to format seconds to duration string (mm:ss or hh:mm:ss)
export const formatSecondsToDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

// Utility function to calculate total playlist duration
export const calculatePlaylistDuration = (tracks: Track[]): string => {
  if (tracks.length === 0) return "0:00";
  
  const totalSeconds = tracks.reduce((acc, track) => {
    return acc + parseDurationToSeconds(track.duration);
  }, 0);
  
  return formatSecondsToDuration(totalSeconds);
};
