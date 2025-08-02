// src/hooks/useAudioPlayer.ts
import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useToast } from "@/hooks/use-toast";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { dropboxService } from "@/services/dropboxService";
import { offlineStorageService, isOnline } from "@/services/offlineStorageService";

// Fisher–Yates shuffle
const shuffleArray = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const useAudioPlayer = () => {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { isTrackDownloaded } = useOfflineStorage();
  const updateTrack = useUpdateTrack();

  // create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      const a = document.createElement("audio");
      a.crossOrigin = "anonymous";
      a.setAttribute("playsinline", "true");
      a.setAttribute("webkit-playsinline", "true");
      a.preload = "metadata";
      audioRef.current = a;
    }
  }, []);

  // ... loadTrack(), timeupdate, auth-refresh, next/prev handlers, etc. unchanged ...

  const playPlaylist = (tracks: Track[], startAt = 0) => {
    if (!tracks.length) return;
    setPlaylist(tracks);

    if (isShuffle) {
      const idx = shuffleArray(tracks.map((_, i) => i));
      setShuffledOrder(idx);
      const first = idx[0];
      setCurrentIndex(first);
      setCurrentTrack({ ...tracks[first] });
    } else {
      setShuffledOrder([]);
      const safe = Math.max(0, Math.min(startAt, tracks.length - 1));
      setCurrentIndex(safe);
      setCurrentTrack({ ...tracks[safe] });
    }

    setIsPlaying(true);
  };

  /** always disable shuffle and start from track #0 */
  const startPlaylistInOrder = (tracks: Track[]) => {
    setIsShuffle(false);
    playPlaylist(tracks, 0);
  };

  const toggleShuffle = () => setIsShuffle((v) => !v);
  // ... other controls …

  return {
    currentTrack,
    playlist,
    currentIndex,
    isShuffle,
    isPlaying,
    playPlaylist,
    startPlaylistInOrder,
    toggleShuffle,
    // …and your other controls (playNext, togglePlayPause, etc.)
  };
};
