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
    // Admins can edit any playlist, users can only edit playlists they created
    if (isAdmin) return true;
    return playlist.created_by === currentUserId;
  };

  const canDeletePlaylist = (playlist: Playlist): boolean => {
    // Admins can delete any playlist, users can only delete playlists they created
    if (isAdmin) return true;
    return playlist.created_by === currentUserId;
  };

  const canManagePlaylistTracks = (playlist: Playlist): boolean => {
    // Admins can manage tracks in any playlist, users can only manage tracks in playlists they created
    if (isAdmin) return true;
    return playlist.created_by === currentUserId;
  };

  const canEditPlaylistPrivacy = (playlist: Playlist): boolean => {
    // Admins can modify privacy for any playlist, users can only modify privacy for playlists they created
    if (isAdmin) return true;
    return playlist.created_by === currentUserId;
  };

  const canSharePlaylist = (playlist: Playlist): boolean => {
    // Private playlists can only be shared by their creators (and admins)
    if (!playlist.isPublic) {
      if (isAdmin) return true;
      return playlist.created_by === currentUserId;
    }
    
    // Public playlists can be shared by any authenticated user (assuming they are band members)
    // since only band members can access playlists according to RLS policies
    return currentUserProfile?.is_band_member || isAdmin || false;
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
    canSharePlaylist,
  };
};