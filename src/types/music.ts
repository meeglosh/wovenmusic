
export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  fileUrl: string;
  addedAt: Date;
}

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
