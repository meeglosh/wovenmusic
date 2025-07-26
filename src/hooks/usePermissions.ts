import { useCurrentUserProfile } from "./useBandMembers";
import { Track, Playlist } from "@/types/music";

export const usePermissions = () => {
  const { data: currentUserProfile } = useCurrentUserProfile();
  
  const isAdmin = currentUserProfile?.is_admin || false;
  const currentUserId = currentUserProfile?.id;

  const canEditTrack = (track: Track): boolean => {
    if (isAdmin) return true;
    // Users can only edit tracks they created
    return track.created_by === currentUserId;
  };

  const canDeleteTrack = (track: Track): boolean => {
    if (isAdmin) return true;
    // Users can only delete tracks they created
    return track.created_by === currentUserId;
  };

  const canEditTrackPrivacy = (track: Track): boolean => {
    if (isAdmin) return true;
    // Users can only modify privacy for tracks they created
    return track.created_by === currentUserId;
  };

  const canEditPlaylist = (playlist: Playlist): boolean => {
    if (isAdmin) return true;
    // Users can only edit playlists they created
    return playlist.created_by === currentUserId;
  };

  const canDeletePlaylist = (playlist: Playlist): boolean => {
    if (isAdmin) return true;
    // Users can only delete playlists they created
    return playlist.created_by === currentUserId;
  };

  const canManagePlaylistTracks = (playlist: Playlist): boolean => {
    if (isAdmin) return true;
    // Users can only manage tracks in playlists they created
    return playlist.created_by === currentUserId;
  };

  const canEditPlaylistPrivacy = (playlist: Playlist): boolean => {
    if (isAdmin) return true;
    // Users can only modify privacy for playlists they created
    return playlist.created_by === currentUserId;
  };

  return {
    isAdmin,
    currentUserId,
    canEditTrack,
    canDeleteTrack,
    canEditTrackPrivacy,
    canEditPlaylist,
    canDeletePlaylist,
    canManagePlaylistTracks,
    canEditPlaylistPrivacy,
  };
};