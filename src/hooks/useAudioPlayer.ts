import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";
import { useUpdateTrack } from "@/hooks/useTracks";
import { useToast } from "@/hooks/use-toast";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";

// Dropbox + offline + URL helpers
import { dropboxService } from "@/services/dropboxService";
import { offlineStorageService, isOnline } from "@/services/offlineStorageService";
import { generateMediaSessionArtwork } from "@/lib/utils";
import { resolveTrackUrl } from "@/services/trackUrls";

// Fisher–Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// mm:ss
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

  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();
  const { isTrackDownloaded } = useOfflineStorage();

  // Playlist state
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [isRepeatMode, setIsRepeatMode] = useState(false);

  // Playlist context for Media Session
  const [currentPlaylistContext, setCurrentPlaylistContext] = useState<{
    id?: string;
    name?: string;
    imageUrl?: string;
    artistName?: string;
  } | null>(null);

  // Create audio element (mobile-friendly)
  useEffect(() => {
    if (!audioRef.current) {
      const audio = document.createElement("audio");
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.preload = "metadata";
      audioRef.current = audio;
    }
  }, []);

  // Load the selected track into the <audio> element
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const audio = audioRef.current;

    const loadTrack = async () => {
      // Must have at least one source: storage_url/fileUrl OR a Dropbox path
      if (
        (!currentTrack.fileUrl || currentTrack.fileUrl === "#" || currentTrack.fileUrl === "") &&
        !currentTrack.dropbox_path &&
        !currentTrack.storage_url &&
        !currentTrack.storage_key
      ) {
        console.log("No valid URL or Dropbox path for track:", currentTrack?.title);
        return;
      }

      try {
        // 1) Prefer offline cache if present
        let audioUrl = await offlineStorageService.getOfflineTrackUrl(currentTrack.id);
        if (audioUrl) {
          // Good—use offline URL
        } else {
          // 2) Otherwise, resolve storage-backed URLs first (R2 -> public/signed)
          const hasR2Public = currentTrack.storage_type === "r2" && !!currentTrack.storage_url && currentTrack.is_public;
          const hasR2Private = currentTrack.storage_type === "r2" && !!currentTrack.storage_key;

          if (hasR2Public) {
            audioUrl = currentTrack.storage_url!;
          } else if (hasR2Private) {
            // Signed edge URL for private R2
            try {
              audioUrl = await resolveTrackUrl(currentTrack.id);
            } catch (err) {
              console.error("Failed to resolve signed R2 URL:", err);
              throw new Error("FAILED_TO_RESOLVE_R2");
            }
          } else {
            // 3) Legacy / Supabase storage fallback
            audioUrl = currentTrack.fileUrl;
          }

          // If we're offline and no cached copy, bail early with UX
          if (!isOnline()) {
            throw new Error("TRACK_NOT_AVAILABLE_OFFLINE");
          }
        }

        // 4) Dropbox fallbacks & refresh logic (for legacy Dropbox-backed tracks)
        if ((!audioUrl || audioUrl === "#" || audioUrl === "") && currentTrack.dropbox_path) {
          if (!dropboxService.isAuthenticated()) throw new Error("DROPBOX_AUTH_REQUIRED");
          try {
            audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
          } catch (e: any) {
            if (e?.message === "DROPBOX_TOKEN_EXPIRED") throw new Error("DROPBOX_TOKEN_EXPIRED");
            throw new Error("DROPBOX_CONNECTION_ERROR");
          }
        } else if (audioUrl && audioUrl.includes("dropboxusercontent.com")) {
          // Temporary links expire—refresh if we have a stored path
          if (currentTrack.dropbox_path) {
            if (!dropboxService.isAuthenticated()) throw new Error("DROPBOX_AUTH_REQUIRED");
            try {
              audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
            } catch (e: any) {
              if (e?.message === "DROPBOX_TOKEN_EXPIRED") throw new Error("DROPBOX_TOKEN_EXPIRED");
              throw new Error("DROPBOX_CONNECTION_ERROR");
            }
          } else {
            throw new Error("NO_DROPBOX_PATH");
          }
        } else if (audioUrl && audioUrl.startsWith("/")) {
          // A raw path likely needs a fresh temp link
          if (!dropboxService.isAuthenticated()) throw new Error("DROPBOX_AUTH_REQUIRED");

          if (currentTrack.dropbox_path) {
            try {
              audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
            } catch (e: any) {
              if (e?.message === "DROPBOX_TOKEN_EXPIRED") throw new Error("DROPBOX_TOKEN_EXPIRED");
              throw new Error("DROPBOX_CONNECTION_ERROR");
            }
          } else {
            // Last-ditch search in a source folder using common extensions
            const sourceFolder = currentTrack.source_folder || "/woven - sketches 24";
            const fileName = `${currentTrack.title} - ${currentTrack.artist}`;
            const possible = [
              `${sourceFolder}/${fileName}.aif`,
              `${sourceFolder}/${fileName}.mp3`,
              `${sourceFolder}/${fileName}.wav`,
              `${sourceFolder}/${currentTrack.title}.aif`,
              `${sourceFolder}/${currentTrack.title}.mp3`,
              `${sourceFolder}/${currentTrack.title}.wav`,
            ];

            let found = "";
            for (const p of possible) {
              try {
                const link = await dropboxService.getTemporaryLink(p);
                found = link;
                break;
              } catch {
                // keep trying
              }
            }
            if (!found) throw new Error(`MISSING_DROPBOX_FILE`);
            audioUrl = found;
          }
        }

        // Load into <audio>
        audio.src = audioUrl!;
        audio.load();

        // Wait until playable
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("error", onErr);
            resolve();
          };
          const onErr = (e: Event) => {
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("error", onErr);
            reject(e);
          };
          if (audio.readyState >= 3) resolve();
          else {
            audio.addEventListener("canplaythrough", onReady);
            audio.addEventListener("error", onErr);
          }
        });

        // Autoplay if requested
        if (isPlaying) {
          try {
            await audio.play();
          } catch (e) {
            console.error("Autoplay failed:", e);
            setIsPlaying(false);
          }
        }
      } catch (e: any) {
        // Clear broken src on error
        if (audio.src) {
          audio.removeAttribute("src");
          audio.load();
        }

        if (!recentlyReauthed) {
          const msg = e?.message || String(e);
          switch (msg) {
            case "DROPBOX_TOKEN_EXPIRED":
              window.dispatchEvent(new CustomEvent("dropboxTokenExpired"));
              break;
            case "DROPBOX_AUTH_REQUIRED":
              window.dispatchEvent(new CustomEvent("dropboxAuthRequired"));
              break;
            case "TRACK_NOT_AVAILABLE_OFFLINE":
              toast({
                title: "Track not available offline",
                description: `"${currentTrack.title}" isn’t downloaded and you’re offline.`,
                variant: "destructive",
              });
              if (playlist.length > 1 && isPlaying) {
                await playNext({ wrap: true });
                return;
              }
              break;
            default:
              // Silent for other network errors
              break;
          }
        }

        setIsPlaying(false);
      }
    };

    loadTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, recentlyReauthed]); // re-run after reauth

  // React to re-auth events
  useEffect(() => {
    const handleAuthRefresh = () => {
      setRecentlyReauthed(true);
      setTimeout(() => setRecentlyReauthed(false), 10_000);
      if (currentTrack) setCurrentTrack((prev) => (prev ? { ...prev } : null));
    };
    window.addEventListener("dropboxAuthRefreshed", handleAuthRefresh);
    return () => window.removeEventListener("dropboxAuthRefreshed", handleAuthRefresh);
  }, [currentTrack]);

  // Bind audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      const d = audio.duration || 0;
      setDuration(d);
      if (currentTrack && d > 0 && (currentTrack.duration === "0:00" || currentTrack.duration === "00:00")) {
        const formatted = formatTime(d);
        updateTrackMutation.mutate({ id: currentTrack.id, updates: { duration: formatted } });
      }
    };
    const onEnded = async () => {
      try {
        const isLast = isShuffleMode
          ? getCurrentIndex() + 1 >= shuffledOrder.length
          : currentTrackIndex + 1 >= playlist.length;

        if (isRepeatMode || !isLast) {
          const ok = await playNext({ wrap: true });
          if (!ok) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      } catch {
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist, currentTrackIndex, isShuffleMode, shuffledOrder, isRepeatMode, currentTrack]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Build shuffled order when enabled
  useEffect(() => {
    if (isShuffleMode && playlist.length > 0) {
      const idx = Array.from({ length: playlist.length }, (_, i) => i);
      setShuffledOrder(shuffleArray(idx));
    }
  }, [isShuffleMode, playlist]);

  const getCurrentIndex = () => {
    if (isShuffleMode && shuffledOrder.length > 0) {
      return shuffledOrder.findIndex((i) => i === currentTrackIndex);
    }
    return currentTrackIndex;
  };

  const getNextTrackIndex = (shouldWrap = false, fromIndex?: number): number => {
    if (playlist.length === 0) return -1;

    const start = fromIndex ?? currentTrackIndex;
    if (isShuffleMode) {
      const curShuffleIdx = fromIndex !== undefined ? shuffledOrder.indexOf(fromIndex) : getCurrentIndex();
      const nextShuffleIdx = curShuffleIdx + 1;
      if (nextShuffleIdx >= shuffledOrder.length) return shouldWrap ? shuffledOrder[0] : -1;
      return shuffledOrder[nextShuffleIdx];
    } else {
      const next = start + 1;
      if (next >= playlist.length) return shouldWrap ? 0 : -1;
      return next;
    }
  };

  const getPreviousTrackIndex = () => {
    if (playlist.length === 0) return -1;
    if (isShuffleMode) {
      const cur = getCurrentIndex();
      const prevShuffleIdx = cur === 0 ? shuffledOrder.length - 1 : cur - 1;
      return shuffledOrder[prevShuffleIdx];
    }
    return currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1;
  };

  const playTrack = (track: Track, newPlaylist?: Track[]) => {
    // Require at least some playable source (storage_url/fileUrl) or a Dropbox path
    const hasUrl =
      (!!track.storage_url && track.storage_url !== "#") ||
      (!!track.fileUrl && track.fileUrl !== "#") ||
      !!track.storage_key ||
      !!track.dropbox_path;

    if (!hasUrl) {
      toast({ title: "Missing audio source", variant: "destructive" });
      return;
    }

    // Respect offline state
    if (!isOnline() && !isTrackDownloaded(track.id)) {
      toast({
        title: "No pulse here - connect to the grid to awaken this sound.",
        variant: "destructive",
      });
      return;
    }

    setCurrentTrack(track);

    if (newPlaylist) {
      setPlaylist(newPlaylist);
      const idx = newPlaylist.findIndex((t) => t.id === track.id);
      setCurrentTrackIndex(idx !== -1 ? idx : 0);
    } else if (playlist.length > 0) {
      const idx = playlist.findIndex((t) => t.id === track.id);
      if (idx !== -1) setCurrentTrackIndex(idx);
    }
  };

  const playPlaylist = (
    tracks: Track[],
    startIndex = 0,
    playlistContext?: { id?: string; name?: string; imageUrl?: string; artistName?: string }
  ) => {
    if (tracks.length === 0) return;

    setPlaylist(tracks);
    setCurrentTrackIndex(startIndex);
    setCurrentPlaylistContext(playlistContext || null);

    // Force new ref for effect to pick up
    setCurrentTrack({ ...tracks[startIndex] });

    // Request autoplay
    setIsPlaying(true);
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        // Ensure readiness
        if (audio.readyState < 2 && audio.src) {
          audio.load();
          await new Promise<void>((resolve, reject) => {
            const to = setTimeout(() => reject(new Error("Audio load timeout")), 3000);
            const onReady = () => {
              clearTimeout(to);
              audio.removeEventListener("canplay", onReady);
              audio.removeEventListener("error", onErr);
              resolve();
            };
            const onErr = () => {
              clearTimeout(to);
              audio.removeEventListener("canplay", onReady);
              audio.removeEventListener("error", onErr);
              reject(new Error("Audio load failed"));
            };
            if (audio.readyState >= 2) onReady();
            else {
              audio.addEventListener("canplay", onReady);
              audio.addEventListener("error", onErr);
            }
          });
        }
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (e) {
      console.error("togglePlayPause failed:", e);
      setIsPlaying(false);
    }
  };

  const playNext = async (options: { wrap?: boolean } = {}): Promise<boolean> => {
    try {
      const nextIdx = getNextTrackIndex(options.wrap);
      if (nextIdx !== -1 && playlist[nextIdx]) {
        const nextTrack = playlist[nextIdx];

        // If offline, ensure next track is cached
        if (!isOnline()) {
          const cached = await offlineStorageService.isTrackDownloaded(nextTrack.id);
          if (!cached) {
            toast({
              title: "Track not downloaded",
              description: `"${nextTrack.title}" is not available offline`,
              variant: "destructive",
            });

            // Search ahead for the next cached track
            let foundIndex = -1;
            let scan = nextIdx;
            for (let i = 0; i < playlist.length; i++) {
              scan = scan + 1;
              if (scan >= playlist.length) scan = options.wrap ? 0 : -1;
              if (scan === -1) break;
              if (await offlineStorageService.isTrackDownloaded(playlist[scan].id)) {
                foundIndex = scan;
                break;
              }
            }

            if (foundIndex === -1) {
              setIsPlaying(false);
              setCurrentTime(0);
              return false;
            }

            setCurrentTrackIndex(foundIndex);
            setCurrentTrack({ ...playlist[foundIndex] });
            return true;
          }
        }

        setCurrentTrackIndex(nextIdx);
        setCurrentTrack({ ...nextTrack });
        return true;
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
        return false;
      }
    } catch (e) {
      console.error("playNext error:", e);
      setIsPlaying(false);
      return false;
    }
  };

  const playPrevious = () => {
    const prevIdx = getPreviousTrackIndex();
    if (prevIdx !== -1 && playlist[prevIdx]) {
      setCurrentTrackIndex(prevIdx);
      setCurrentTrack({ ...playlist[prevIdx] });

      if (isPlaying) {
        setTimeout(async () => {
          const audio = audioRef.current;
          if (!audio) return;
          try {
            await audio.play();
            setIsPlaying(true);
          } catch (e) {
            setIsPlaying(false);
          }
        }, 300);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const toggleShuffle = () => setIsShuffleMode((p) => !p);
  const toggleRepeat = () => setIsRepeatMode((p) => !p);

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolumeLevel = (v: number) => setVolume(Math.max(0, Math.min(1, v)));

  // Media Session metadata
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (currentTrack) {
      const { title, artist } = currentTrack;
      let artwork = [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ];

      if (currentPlaylistContext?.imageUrl) {
        const jpegArtwork = generateMediaSessionArtwork(currentPlaylistContext.imageUrl);
        if (jpegArtwork.length) {
          artwork = [...jpegArtwork, ...artwork];
        }
      }

      const album = currentPlaylistContext?.name || "Woven Music";

      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "Unknown Title",
        artist: currentPlaylistContext?.artistName || artist || "Unknown Artist",
        album,
        artwork,
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentTrack, currentPlaylistContext]);

  // Media Session playback state
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  // Media Session position state
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration,
        position: currentTime,
        playbackRate: 1.0,
      });
    }
  }, [currentTime, duration, currentTrack]);

  // Media Session action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => {
        if (!isPlaying) togglePlayPause();
      },
      pause: () => {
        if (isPlaying) togglePlayPause();
      },
      previoustrack: () => {
        if (playlist.length > 1) playPrevious();
      },
      nexttrack: () => {
        if (playlist.length > 1) playNext();
      },
      seekto: (details: MediaSessionActionDetails) => {
        if (details.seekTime != null) seekTo(details.seekTime);
      },
    };

    (Object.keys(handlers) as MediaSessionAction[]).forEach((action) => {
      try {
        navigator.mediaSession.setActionHandler(action, handlers[action] || null);
      } catch {
        // ignore unsupported actions
      }
    });

    return () => {
      (Object.keys(handlers) as MediaSessionAction[]).forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playlist.length]);

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
