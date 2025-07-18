
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
