
export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  fileUrl: string;
  addedAt: Date;
  source_folder?: string;
  dropbox_path?: string;
}

// Utility function to extract file extension from a track
export const getFileExtension = (track: Track): string => {
  const filePath = track.dropbox_path || track.fileUrl || '';
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  return extension;
};

// Utility function to get extension with color coding for browser compatibility
export const getExtensionWithStatus = (track: Track): { extension: string; compatible: boolean } => {
  const ext = getFileExtension(track);
  const compatible = ['wav', 'mp3', 'mp4', 'm4a', 'ogg', 'aac'].includes(ext);
  return { extension: ext, compatible };
};

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: Date;
  sharedWith: string[];
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
}
