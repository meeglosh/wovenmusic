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
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [recentlyReauthed, setRecentlyReauthed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Add mutation for updating track duration
  const updateTrackMutation = useUpdateTrack();
  const { toast } = useToast();
  const { isTrackDownloaded } = useOfflineStorage();

  // Playlist functionality
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [isRepeatMode, setIsRepeatMode] = useState(false);
  
  // Current playlist context for Media Session
  const [currentPlaylistContext, setCurrentPlaylistContext] = useState<{
    id?: string;
    name?: string;
    imageUrl?: string;
  } | null>(null);

  // Create or get the audio element with mobile optimizations
  useEffect(() => {
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.crossOrigin = 'anonymous';
      
      // Mobile-specific audio optimizations
      audio.setAttribute('playsinline', 'true'); // Prevent fullscreen on iOS
      audio.setAttribute('webkit-playsinline', 'true'); // Legacy iOS support
      audio.preload = 'metadata'; // Load metadata but not full audio initially
      
      audioRef.current = audio;
      console.log('Audio element created with mobile optimizations');
      console.log('Audio attributes:', {
        crossOrigin: audio.crossOrigin,
        playsinline: audio.getAttribute('playsinline'),
        preload: audio.preload
      });
    }
  }, []);

  // Track loading and metadata
  useEffect(() => {
    
    if (!currentTrack || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;

    const loadTrack = async () => {
      // Check if we have either a fileUrl or a dropbox_path to work with
      if ((!currentTrack?.fileUrl || currentTrack.fileUrl === "#" || currentTrack.fileUrl === "") && !currentTrack?.dropbox_path) {
        console.log('No valid file URL or Dropbox path for track:', currentTrack?.title);
        return;
      }

      try {
        console.log('=== ATTEMPTING TO LOAD TRACK ===');
        console.log('Track file URL:', currentTrack.fileUrl);
        console.log('Track dropbox path:', currentTrack.dropbox_path);
        
        // First check if track is available offline
        let audioUrl = await offlineStorageService.getOfflineTrackUrl(currentTrack.id);
        
        if (audioUrl) {
          console.log('Using offline cached track');
        } else {
          // Fall back to streaming if not cached or if online
          console.log('Track not cached or offline mode not available, using streaming');
          audioUrl = currentTrack.fileUrl;
          
          // Show helpful message if offline and track not downloaded
          if (!isOnline()) {
            console.warn('User is offline and track is not downloaded');
            throw new Error('TRACK_NOT_AVAILABLE_OFFLINE');
          }
        }
        
        // If no valid fileUrl, but we have dropbox_path, get fresh URL from Dropbox
        if ((!audioUrl || audioUrl === "#" || audioUrl === "") && currentTrack.dropbox_path) {
          console.log('No fileUrl, using dropbox_path to get fresh URL:', currentTrack.dropbox_path);
          
          if (!dropboxService.isAuthenticated()) {
            console.error('Dropbox not authenticated - cannot get temporary link');
            throw new Error('DROPBOX_AUTH_REQUIRED');
          }
          
          try {
            audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
            console.log('SUCCESS! Got fresh temporary URL from dropbox_path');
          } catch (error) {
            console.error('Dropbox path failed:', error.message);
            if (error.message === 'DROPBOX_TOKEN_EXPIRED') {
              throw new Error('DROPBOX_TOKEN_EXPIRED');
            }
            throw new Error('DROPBOX_CONNECTION_ERROR');
          }
        }
        // Check if this is a Dropbox temporary URL that might have expired
        else if (audioUrl && audioUrl.includes('dropboxusercontent.com')) {
          console.log('Detected Dropbox temporary URL, checking if it needs refresh...');
          
          // First check if we have a stored dropbox_path for this track
          if (currentTrack.dropbox_path) {
            console.log('Using stored dropbox_path to get fresh URL:', currentTrack.dropbox_path);
            try {
              // Check if Dropbox is authenticated before trying to get temp link
              if (!dropboxService.isAuthenticated()) {
                console.error('Dropbox not authenticated - cannot refresh URL');
                throw new Error('DROPBOX_AUTH_REQUIRED');
              }
              audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
              console.log('SUCCESS! Got fresh temporary URL from stored path');
            } catch (error) {
              console.error('Stored path failed:', error.message);
              if (error.message === 'DROPBOX_TOKEN_EXPIRED') {
                throw new Error('DROPBOX_TOKEN_EXPIRED');
              }
              throw new Error('DROPBOX_CONNECTION_ERROR');
            }
          } else {
            console.log('No stored dropbox_path available, will try fallback methods');
            throw new Error('No stored Dropbox path available for this track');
          }
        }
        // Handle direct paths that need temporary link generation
        else if (audioUrl.startsWith('/')) {
          console.log('Getting fresh Dropbox temporary link...');
          
          // Check if Dropbox is authenticated
          if (!dropboxService.isAuthenticated()) {
            console.error('Dropbox not authenticated - cannot get temporary link');
            throw new Error('DROPBOX_AUTH_REQUIRED');
          }
          
          // First check if we have a stored dropbox_path for this track
          if (currentTrack.dropbox_path) {
            console.log('Using stored dropbox_path:', currentTrack.dropbox_path);
            try {
              audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
              console.log('SUCCESS! Got fresh temporary URL from stored path');
            } catch (error) {
              console.error('Stored path failed:', error.message);
              if (error.message === 'DROPBOX_TOKEN_EXPIRED') {
                throw new Error('DROPBOX_TOKEN_EXPIRED');
              }
              throw new Error('DROPBOX_CONNECTION_ERROR');
            }
          } else {
            // Fallback: search in the source folder with multiple extensions
            const sourceFolder = currentTrack.source_folder || '/woven - sketches 24';
            const fileName = `${currentTrack.title} - ${currentTrack.artist}`;
            const possiblePaths = [
              `${sourceFolder}/${fileName}.aif`,
              `${sourceFolder}/${fileName}.mp3`,
              `${sourceFolder}/${fileName}.wav`,
              `${sourceFolder}/${currentTrack.title}.aif`,
              `${sourceFolder}/${currentTrack.title}.mp3`,
              `${sourceFolder}/${currentTrack.title}.wav`
            ];
            
            console.log('Searching in source folder:', sourceFolder);
            let foundWorking = false;
            for (const path of possiblePaths) {
              try {
                console.log('Trying Dropbox path:', path);
                audioUrl = await dropboxService.getTemporaryLink(path);
                console.log('SUCCESS! Got fresh temporary URL:', audioUrl);
                
                // Store the working path for future use
                console.log('Storing working path for future use:', path);
                foundWorking = true;
                break;
              } catch (error) {
                console.log(`Path ${path} failed:`, error.message);
                continue;
              }
            }
            
            if (!foundWorking) {
              console.error('Could not find any working path for track:', currentTrack.title);
              throw new Error(`Cannot find audio file for "${currentTrack.title}" in folder ${sourceFolder}`);
            }
          }
        }

        console.log('Final audio URL ready for playback:', audioUrl);
        
        // Set the audio source and load it
        audio.src = audioUrl;
        audio.load();
        
        // Wait for the audio to be ready
        const canPlayPromise = new Promise((resolve, reject) => {
          const handleCanPlay = () => {
            console.log('Audio can play - track loaded successfully');
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve(true);
          };
          
          const handleError = (e) => {
            console.error('Audio load error details:', {
              type: e.type,
              target: e.target,
              error: e.target?.error,
              networkState: e.target?.networkState,
              readyState: e.target?.readyState,
              src: e.target?.src,
              currentSrc: e.target?.currentSrc
            });
            if (e.target?.error) {
              console.error('Audio error code:', e.target.error.code);
              console.error('Audio error message:', e.target.error.message);
            }
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(e);
          };
          
          audio.addEventListener('canplaythrough', handleCanPlay);
          audio.addEventListener('error', handleError);
          
          // Also try to play immediately if it's already loaded
          if (audio.readyState >= 3) {
            handleCanPlay();
          }
        });
        
        console.log('Starting audio load...');
        await canPlayPromise;
        console.log('Audio loaded successfully!');
        
        // Auto-start playback if isPlaying state is true (from playPlaylist)
        if (isPlaying) {
          console.log('Auto-starting playback as requested...');
          try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              await playPromise;
              console.log('Auto-play successful');
            }
          } catch (error) {
            console.error('Auto-play failed:', error);
            setIsPlaying(false);
          }
        } else {
          console.log('Audio loaded, ready for playback when user interacts');
        }
        
        } catch (error) {
        console.error('Failed to load track:', error);
        
        // Only dispatch auth events if we haven't recently re-authenticated
        // This prevents loops after successful re-auth
        if (!recentlyReauthed) {
          // Handle specific error types with user-friendly messages
          if (error.message === 'DROPBOX_TOKEN_EXPIRED') {
            console.error('Dropbox token expired - user needs to re-authenticate');
            // Emit a custom event for the app to handle gracefully
            window.dispatchEvent(new CustomEvent('dropboxTokenExpired'));
          } else if (error.message === 'DROPBOX_AUTH_REQUIRED') {
            console.error('Dropbox authentication required');
            window.dispatchEvent(new CustomEvent('dropboxAuthRequired'));
          } else if (error.message === 'DROPBOX_CONNECTION_ERROR') {
            console.error('Dropbox connection error');
            // Could add a toast or other UI feedback here
          }
        } else {
          console.log('Skipping auth event dispatch - recently re-authenticated');
        }
      }
    };
    
    loadTrack();
  }, [currentTrack, recentlyReauthed]); // Include recentlyReauthed in dependencies

  // Listen for auth refresh events
  useEffect(() => {
    const handleAuthRefresh = () => {
      console.log('Auth refreshed in useAudioPlayer, setting reauth flag and reloading track');
      setRecentlyReauthed(true);
      
      // Clear the flag after a delay to allow normal error handling later
      setTimeout(() => {
        setRecentlyReauthed(false);
      }, 10000); // 10 second cooldown period
      
      // If we have a current track, try to reload it with fresh auth
      if (currentTrack) {
        console.log('Reloading current track with fresh auth...');
        // Trigger a reload by updating the currentTrack dependency
        setCurrentTrack(prev => prev ? { ...prev } : null);
      }
    };

    window.addEventListener('dropboxAuthRefreshed', handleAuthRefresh);
    return () => {
      window.removeEventListener('dropboxAuthRefreshed', handleAuthRefresh);
    };
  }, [currentTrack]);

  // Time and duration updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      const audioDuration = audio.duration || 0;
      setDuration(audioDuration);
      
      // Update track duration in database if it's currently 0:00 and we have a valid duration
      if (currentTrack && audioDuration > 0 && (currentTrack.duration === '0:00' || currentTrack.duration === '00:00')) {
        const formattedDuration = formatTime(audioDuration);
        console.log(`Updating track duration from ${currentTrack.duration} to ${formattedDuration}`);
        updateTrackMutation.mutate({
          id: currentTrack.id,
          updates: { duration: formattedDuration }
        });
      }
    };
    const handleEnded = () => {
      console.log('Track ended, playing next...');
      // Keep isPlaying true for auto-advance to next track
      setIsPlaying(true);
      playNext();
    };

    // Keep isPlaying state in sync with actual audio state
    const handlePlay = () => {
      console.log('Audio play event - syncing state');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('Audio pause event - syncing state');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [playlist, currentTrackIndex, isShuffleMode, shuffledOrder, isRepeatMode, currentTrack, updateTrackMutation]);

  // Volume control
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  // Generate shuffled order when shuffle mode is enabled
  useEffect(() => {
    if (isShuffleMode && playlist.length > 0) {
      const indices = Array.from({ length: playlist.length }, (_, i) => i);
      const shuffled = shuffleArray(indices);
      setShuffledOrder(shuffled);
    }
  }, [isShuffleMode, playlist]);

  const getCurrentIndex = () => {
    if (isShuffleMode && shuffledOrder.length > 0) {
      return shuffledOrder.findIndex(index => index === currentTrackIndex);
    }
    return currentTrackIndex;
  };

  const getNextTrackIndex = () => {
    const currentIndex = getCurrentIndex();
    const playlistLength = playlist.length;
    
    if (playlistLength === 0) return -1;
    
    if (isRepeatMode && playlistLength === 1) {
      return currentTrackIndex; // Repeat single track
    }
    
    if (isShuffleMode) {
      const nextShuffleIndex = (currentIndex + 1) % shuffledOrder.length;
      return shuffledOrder[nextShuffleIndex];
    } else {
      const nextIndex = (currentTrackIndex + 1) % playlistLength;
      return nextIndex;
    }
  };

  const getPreviousTrackIndex = () => {
    const currentIndex = getCurrentIndex();
    const playlistLength = playlist.length;
    
    if (playlistLength === 0) return -1;
    
    if (isShuffleMode) {
      const prevShuffleIndex = currentIndex === 0 ? shuffledOrder.length - 1 : currentIndex - 1;
      return shuffledOrder[prevShuffleIndex];
    } else {
      const prevIndex = currentTrackIndex === 0 ? playlistLength - 1 : currentTrackIndex - 1;
      return prevIndex;
    }
  };

  const playTrack = (track: Track, newPlaylist?: Track[]) => {
    console.log('=== PLAY TRACK ===');
    console.log('Track object:', track);
    console.log('Track title:', track.title);
    console.log('Track fileUrl:', track.fileUrl);
    console.log('Track dropbox_path:', track.dropbox_path);
    console.log('Has valid source?', !!(track.fileUrl && track.fileUrl !== "#" && track.fileUrl !== "") || !!track.dropbox_path);

    // Check if we have either a fileUrl or dropbox_path
    if ((!track.fileUrl || track.fileUrl === "#" || track.fileUrl === "") && !track.dropbox_path) {
      console.error('Track has no valid fileUrl or dropbox_path');
      return;
    }

    // Check if offline and track not downloaded
    if (!navigator.onLine && !isTrackDownloaded(track.id)) {
      console.log('User is offline and track not downloaded - preventing playback');
      toast({
        title: "No pulse here - connect to the grid to awaken this sound.",
        variant: "destructive",
      });
      return;
    }

    setCurrentTrack(track);
    
    if (newPlaylist) {
      setPlaylist(newPlaylist);
      const trackIndex = newPlaylist.findIndex(t => t.id === track.id);
      setCurrentTrackIndex(trackIndex !== -1 ? trackIndex : 0);
    } else if (playlist.length > 0) {
      const trackIndex = playlist.findIndex(t => t.id === track.id);
      if (trackIndex !== -1) {
        setCurrentTrackIndex(trackIndex);
      }
    }
  };

  const playPlaylist = (tracks: Track[], startIndex: number = 0, playlistContext?: { id?: string; name?: string; imageUrl?: string }) => {
    console.log('=== PLAY PLAYLIST ===');
    console.log('Tracks count:', tracks.length);
    console.log('Start index:', startIndex);
    console.log('First track details:', tracks[0]);
    console.log('Playlist context:', playlistContext);
    console.log('Dropbox authenticated:', dropboxService.isAuthenticated());
    
    if (tracks.length === 0) return;
    
    setPlaylist(tracks);
    setCurrentTrackIndex(startIndex);
    setCurrentPlaylistContext(playlistContext || null);
    const trackToPlay = tracks[startIndex];
    console.log('Setting current track:', trackToPlay);
    
    // Force a new object reference to ensure React sees the change
    setCurrentTrack({ ...trackToPlay });
    
    // Auto-start playback when a new track is selected
    setIsPlaying(true);
    
    console.log('Track set with auto-play enabled, waiting for useEffect to load...');
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('Audio element not available');
      return;
    }

    console.log('Toggle play/pause - current state:', {
      paused: audio.paused,
      readyState: audio.readyState,
      networkState: audio.networkState,
      src: !!audio.src
    });

    try {
      if (audio.paused) {
        console.log('Starting playback...');
        
        // Ensure audio is ready before playing
        if (audio.readyState < 2 && audio.src) {
          console.log('Audio not ready, forcing load...');
          audio.load();
          
          // Wait for audio to be ready
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Audio load timeout'));
            }, 3000);
            
            const onCanPlay = () => {
              clearTimeout(timeout);
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              resolve(null);
            };
            
            const onError = () => {
              clearTimeout(timeout);
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              reject(new Error('Audio load failed'));
            };
            
            if (audio.readyState >= 2) {
              onCanPlay();
            } else {
              audio.addEventListener('canplay', onCanPlay);
              audio.addEventListener('error', onError);
            }
          });
        }
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log('Audio play successful');
        }
      } else {
        console.log('Pausing playback...');
        audio.pause();
        console.log('Audio paused');
      }
    } catch (error) {
      console.error('Toggle play/pause failed:', error);
      setIsPlaying(false);
    }
  };

  const playNext = () => {
    console.log('=== PLAY NEXT DEBUG ===');
    console.log('Current track index:', currentTrackIndex);
    console.log('Playlist length:', playlist.length);
    console.log('Is repeat mode:', isRepeatMode);
    console.log('Is shuffle mode:', isShuffleMode);
    console.log('Current playing state:', isPlaying);
    
    const nextIndex = getNextTrackIndex();
    console.log('Next index calculated:', nextIndex);
    
    if (nextIndex !== -1 && playlist[nextIndex]) {
      console.log(`Moving to next track: ${nextIndex} (${playlist[nextIndex].title})`);
      setCurrentTrackIndex(nextIndex);
      const nextTrack = playlist[nextIndex];
      
      // Force a new object reference to trigger track loading
      setCurrentTrack({ ...nextTrack });
      
      // Keep playing state - the track loading effect will handle auto-play
      console.log('Next track set, keeping isPlaying state for auto-continue');
    } else {
      console.log('No next track available, stopping playback');
      setIsPlaying(false);
    }
  };

  const playPrevious = () => {
    const prevIndex = getPreviousTrackIndex();
    if (prevIndex !== -1 && playlist[prevIndex]) {
      setCurrentTrackIndex(prevIndex);
      setCurrentTrack(playlist[prevIndex]);
      
      // Play previous track if user was already playing
      if (isPlaying) {
        setTimeout(async () => {
          const audio = audioRef.current;
          if (audio) {
            try {
              await audio.play();
              setIsPlaying(true);
            } catch (error) {
              console.error('Error playing previous track:', error);
              setIsPlaying(false);
            }
          }
        }, 500);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const toggleShuffle = () => {
    setIsShuffleMode(prev => !prev);
  };

  const toggleRepeat = () => {
    setIsRepeatMode(prev => !prev);
  };

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolumeLevel = (newVolume: number) => {
    setVolume(Math.max(0, Math.min(1, newVolume)));
  };

  // Media Session API integration
  useEffect(() => {
    // Check if Media Session API is supported
    if (!('mediaSession' in navigator)) {
      return;
    }

    // Update metadata when track changes
    if (currentTrack) {
      const { title, artist } = currentTrack;
      
      // Determine artwork - prefer playlist image, then fallback to app icons
      let artwork = [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
      ];
      
      // If playing from a playlist with an image, use the playlist artwork
      if (currentPlaylistContext?.imageUrl) {
        artwork = [
          { src: currentPlaylistContext.imageUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: currentPlaylistContext.imageUrl, sizes: '192x192', type: 'image/jpeg' },
          ...artwork // Fallback to app icons
        ];
      }
      
      // Determine album name - use playlist name if playing from playlist, otherwise default
      const album = currentPlaylistContext?.name || 'Woven Music';
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Unknown Title',
        artist: artist || 'Unknown Artist',
        album: album,
        artwork: artwork
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentTrack, currentPlaylistContext]);

  // Update playback state for Media Session
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Update position state for Media Session
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration: duration,
        position: currentTime,
        playbackRate: 1.0
      });
    }
  }, [currentTime, duration, currentTrack]);

  // Register Media Session action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return;
    }

    const actionHandlers = {
      play: () => {
        if (!isPlaying) {
          togglePlayPause();
        }
      },
      pause: () => {
        if (isPlaying) {
          togglePlayPause();
        }
      },
      previoustrack: () => {
        if (playlist.length > 1) {
          playPrevious();
        }
      },
      nexttrack: () => {
        if (playlist.length > 1) {
          playNext();
        }
      },
      seekto: (details) => {
        if (details.seekTime != null) {
          seekTo(details.seekTime);
        }
      }
    };

    // Set action handlers
    Object.entries(actionHandlers).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch (error) {
        console.warn(`The media session action "${action}" is not supported.`);
      }
    });

    // Cleanup function to remove handlers
    return () => {
      Object.keys(actionHandlers).forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
        } catch (error) {
          // Ignore cleanup errors
        }
      });
    };
  }, [isPlaying, playlist.length, togglePlayPause, playNext, playPrevious, seekTo]);

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
    formatTime
  };
};