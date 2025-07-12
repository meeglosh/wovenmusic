
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
}

// Utility function to get the full filename from a track
export const getFileName = (track: Track): string => {
  // Try to get the filename from dropbox_path first, then fileUrl
  const filePath = track.dropbox_path || track.fileUrl || '';
  // Extract just the filename from the full path
  const fileName = filePath.split('/').pop() || track.title;
  return fileName;
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
