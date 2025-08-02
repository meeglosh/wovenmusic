import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useToast } from "@/hooks/use-toast";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";

// Import the existing DropboxService singleton
import { dropboxService } from "@/services/dropboxService";
import { offlineStorageService, isOnline } from "@/services/offlineStorageService";

// Shuffle function using Fisher-Yates algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Helper function to format time
const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [recentlyReauthed, setRecentlyReauthed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track‐duration mutation + toast + offline check
  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();
  const { isTrackDownloaded } = useOfflineStorage();

  // Playlist state
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [isRepeatMode, setIsRepeatMode] = useState(false);

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      const audio = document.createElement("audio");
      audio.crossOrigin = "anonymous";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.preload = "metadata";
      audioRef.current = audio;
    }
  }, []);

  // load / play logic (unchanged)
  useEffect(() => {
    /* ... your existing loadTrack() logic ... */
  }, [currentTrack, recentlyReauthed]);

  /* ... other useEffect hooks for auth refresh, timeupdate, volume, shuffle generation ... */

  /* Helpers to get next/prev indexes (unchanged) */
  const getCurrentIndex = () => {
    if (isShuffleMode && shuffledOrder.length) {
      return shuffledOrder.findIndex((i) => i === currentTrackIndex);
    }
    return currentTrackIndex;
  };
  const getNextTrackIndex = () => {
    /* ... */
    return isShuffleMode
      ? shuffledOrder[(getCurrentIndex() + 1) % shuffledOrder.length]
      : (currentTrackIndex + 1) % playlist.length;
  };
  const getPreviousTrackIndex = () => {
    /* ... */
    return isShuffleMode
      ? shuffledOrder[(getCurrentIndex() + shuffledOrder.length - 1) % shuffledOrder.length]
      : (currentTrackIndex + playlist.length - 1) % playlist.length;
  };

  // play a single track (unchanged)
  const playTrack = (track: Track, newPlaylist?: Track[]) => {
    /* ... */
  };

  // your existing playPlaylist, now respecting isShuffleMode:
  const playPlaylist = (tracks: Track[], startIndex: number = 0) => {
    if (!tracks.length) return;

    setPlaylist(tracks);

    if (isShuffleMode) {
      const indices = tracks.map((_, i) => i);
      const shuffled = shuffleArray(indices);
      setShuffledOrder(shuffled);

      const firstShuffled = shuffled[0];
      setCurrentTrackIndex(firstShuffled);
      setCurrentTrack({ ...tracks[firstShuffled] });
    } else {
      // clear any old shuffle order
      setShuffledOrder([]);

      // play in “natural” order
      const safeIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setCurrentTrackIndex(safeIndex);
      setCurrentTrack({ ...tracks[safeIndex] });
    }

    setIsPlaying(true);
  };

  // **NEW** helper: always turn OFF shuffle, then play in order from track 0
  const startPlaylistInOrder = (tracks: Track[]) => {
    setIsShuffleMode(false);
    playPlaylist(tracks, 0);
  };

  // rest of your controls (togglePlayPause, playNext, playPrevious, toggleShuffle, toggleRepeat, seekTo, setVolumeLevel)
  const togglePlayPause = async () => { /* ... */ };
  const playNext = () => { /* ... */ };
  const playPrevious = () => { /* ... */ };
  const toggleShuffle = () => setIsShuffleMode((p) => !p);
  const toggleRepeat = () => setIsRepeatMode((p) => !p);
  const seekTo = (t: number) => { /* ... */ };
  const setVolumeLevel = (v: number) => setVolume(Math.max(0, Math.min(1, v)));

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioRef,
    playlist,
    currentTrackIndex,
    isShuffleMode,
    isRepeatMode,
    playTrack,
    playPlaylist,
    // **new**:
    startPlaylistInOrder,
    togglePlayPause,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    seekTo,
    setVolume: setVolumeLevel,
    formatTime,
  };
};
