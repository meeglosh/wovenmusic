// src/hooks/useAudioPlayer.ts
import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useToast } from "@/hooks/use-toast";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
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

// Helper to format time
const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [recentlyReauthed, setRecentlyReauthed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();
  const { isTrackDownloaded } = useOfflineStorage();

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

  // Track loading / metadata logic
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    // ... existing loadTrack() implementation from your code, unchanged ...
  }, [currentTrack, recentlyReauthed]);

  // Other effects: auth refresh, timeupdate, volume, shuffle generation...

  const getCurrentIndex = () => {
    if (isShuffleMode && shuffledOrder.length)
      return shuffledOrder.findIndex((i) => i === currentTrackIndex);
    return currentTrackIndex;
  };
  const getNextTrackIndex = () => {
    if (!playlist.length) return -1;
    if (isRepeatMode && playlist.length === 1) return currentTrackIndex;
    return isShuffleMode
      ? shuffledOrder[(getCurrentIndex() + 1) % shuffledOrder.length]
      : (currentTrackIndex + 1) % playlist.length;
  };
  const getPreviousTrackIndex = () => {
    if (!playlist.length) return -1;
    return isShuffleMode
      ? shuffledOrder[(getCurrentIndex() + shuffledOrder.length - 1) % shuffledOrder.length]
      : (currentTrackIndex + playlist.length - 1) % playlist.length;
  };

  // play a single track
  const playTrack = (track: Track, newPlaylist?: Track[]) => {
    // ... unchanged logic ...
  };

  // play a playlist respecting shuffle mode
  const playPlaylist = (tracks: Track[], startIndex = 0) => {
    if (!tracks.length) return;
    setPlaylist(tracks);
    if (isShuffleMode) {
      const indices = tracks.map((_, i) => i);
      const shuffled = shuffleArray(indices);
      setShuffledOrder(shuffled);
      const firstId = shuffled[0];
      setCurrentTrackIndex(firstId);
      setCurrentTrack({ ...tracks[firstId] });
    } else {
      setShuffledOrder([]);
      const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setCurrentTrackIndex(idx);
      setCurrentTrack({ ...tracks[idx] });
    }
    setIsPlaying(true);
  };

  // helper to always play in order from the start
  const startPlaylistInOrder = (tracks: Track[]) => {
    setIsShuffleMode(false);
    playPlaylist(tracks, 0);
  };

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
