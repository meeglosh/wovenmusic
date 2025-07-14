import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";
import { useUpdateTrack } from "@/hooks/useTracks";

// Import the existing DropboxService singleton
import { dropboxService } from "@/services/dropboxService";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Add mutation for updating track duration
  const updateTrackMutation = useUpdateTrack();

  // Playlist functionality
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [isRepeatMode, setIsRepeatMode] = useState(false);

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

  // Track loading and metadata - simplified with debug
  useEffect(() => {
    console.log('=== TRACK LOADING USEEFFECT TRIGGERED ===');
    console.log('currentTrack:', currentTrack);
    console.log('audioRef.current:', audioRef.current);
    console.log('currentTrack changed, current ID:', currentTrack?.id);
    
    if (!currentTrack || !audioRef.current) {
      console.log('Track loading skipped - currentTrack:', !!currentTrack, 'audioRef:', !!audioRef.current);
      return;
    }

    const audio = audioRef.current;
    console.log('=== LOADING TRACK ===');
    console.log('Track:', currentTrack.title);
    console.log('URL:', currentTrack.fileUrl);

    const loadTrack = async () => {
      if (!currentTrack?.fileUrl || currentTrack.fileUrl === "#") {
        console.log('No valid file URL for track:', currentTrack?.title);
        return;
      }

      try {
        console.log('=== ATTEMPTING TO LOAD TRACK ===');
        console.log('Track file URL:', currentTrack.fileUrl);
        
        let audioUrl = currentTrack.fileUrl;
        
        // Check if this is a Dropbox temporary URL that might have expired
        if (audioUrl.includes('dropboxusercontent.com')) {
          console.log('Detected Dropbox temporary URL, checking if it needs refresh...');
          
          // First check if we have a stored dropbox_path for this track
          if (currentTrack.dropbox_path) {
            console.log('Using stored dropbox_path to get fresh URL:', currentTrack.dropbox_path);
            try {
              // Check if Dropbox is authenticated before trying to get temp link
              if (!dropboxService.isAuthenticated()) {
                console.error('Dropbox not authenticated - cannot refresh URL');
                throw new Error('Dropbox authentication required to play this track');
              }
              audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
              console.log('SUCCESS! Got fresh temporary URL from stored path');
            } catch (error) {
              console.error('Stored path failed:', error.message);
              throw new Error(`Cannot access Dropbox file. Please check your Dropbox connection.`);
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
            throw new Error('Dropbox authentication required to play this track');
          }
          
          // First check if we have a stored dropbox_path for this track
          if (currentTrack.dropbox_path) {
            console.log('Using stored dropbox_path:', currentTrack.dropbox_path);
            try {
              audioUrl = await dropboxService.getTemporaryLink(currentTrack.dropbox_path);
              console.log('SUCCESS! Got fresh temporary URL from stored path');
            } catch (error) {
              console.error('Stored path failed:', error.message);
              throw new Error(`Cannot access Dropbox file. Please check your Dropbox connection.`);
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
        
        // Don't auto-play on mobile - wait for user interaction
        console.log('Audio loaded, ready for playback when user interacts');
        
      } catch (error) {
        console.error('Failed to load track:', error);
      }
    };
    
    loadTrack();
  }, [currentTrack]); // Make sure we include currentTrack in dependencies

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
      playNext();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
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
    console.log('Track fileUrl type:', typeof track.fileUrl);
    console.log('Is fileUrl valid?', !!track.fileUrl && track.fileUrl.length > 0);

    if (!track.fileUrl || track.fileUrl === "#") {
      console.error('Track has no valid fileUrl');
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

  const playPlaylist = (tracks: Track[], startIndex: number = 0) => {
    console.log('=== PLAY PLAYLIST ===');
    console.log('Tracks count:', tracks.length);
    console.log('Start index:', startIndex);
    console.log('First track details:', tracks[0]);
    console.log('Dropbox authenticated:', dropboxService.isAuthenticated());
    
    if (tracks.length === 0) return;
    
    setPlaylist(tracks);
    setCurrentTrackIndex(startIndex);
    const trackToPlay = tracks[startIndex];
    console.log('Setting current track:', trackToPlay);
    
    // Force a new object reference to ensure React sees the change
    setCurrentTrack({ ...trackToPlay });
    
    console.log('Track set, waiting for useEffect to load and play...');
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('Audio element not available');
      return;
    }

    // Mobile debugging
    console.log('=== MOBILE AUDIO DEBUG ===');
    console.log('User agent:', navigator.userAgent);
    console.log('Is mobile device:', /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    console.log('Audio state:', {
      src: audio.src,
      readyState: audio.readyState,
      networkState: audio.networkState,
      paused: audio.paused,
      muted: audio.muted,
      volume: audio.volume
    });

    try {
      if (isPlaying) {
        await audio.pause();
        setIsPlaying(false);
        console.log('Paused audio');
      } else {
        console.log('Attempting to play audio...');
        
        // Mobile-specific audio handling
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          console.log('Mobile device detected - applying mobile audio fixes');
          
          // For mobile, ensure we have a proper audio source and load it
          if (!audio.src && currentTrack) {
            console.log('No audio source on mobile, reloading track...');
            const trackToLoad = { ...currentTrack };
            setCurrentTrack(trackToLoad);
            return; // Let the useEffect handle loading, then user can try play again
          }
          
          // On mobile, try to load first if not ready
          if (audio.readyState < 2) {
            console.log('Audio not ready on mobile, forcing load...');
            audio.load();
            
            // Wait for loadeddata event before attempting play
            const waitForLoad = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                audio.removeEventListener('loadeddata', onLoadedData);
                audio.removeEventListener('error', onError);
                reject(new Error('Audio load timeout'));
              }, 5000);
              
              const onLoadedData = () => {
                clearTimeout(timeout);
                audio.removeEventListener('loadeddata', onLoadedData);
                audio.removeEventListener('error', onError);
                resolve(true);
              };
              
              const onError = (e) => {
                clearTimeout(timeout);
                audio.removeEventListener('loadeddata', onLoadedData);
                audio.removeEventListener('error', onError);
                reject(e);
              };
              
              audio.addEventListener('loadeddata', onLoadedData);
              audio.addEventListener('error', onError);
              
              // If already loaded, resolve immediately
              if (audio.readyState >= 2) {
                clearTimeout(timeout);
                resolve(true);
              }
            });
            
            try {
              await waitForLoad;
              console.log('Audio loaded successfully on mobile');
            } catch (error) {
              console.error('Audio load failed on mobile:', error);
              return;
            }
          }
        }
        
        // Try to play
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          console.log('Playing audio successfully');
        }
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      console.log('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.log('Auto-play blocked by browser. User interaction required.');
        } else if (error.name === 'NotSupportedError') {
          console.log('Audio format not supported on this device.');
        } else if (error.name === 'AbortError') {
          console.log('Audio play was aborted.');
        }
      }
      
      setIsPlaying(false);
    }
  };

  const playNext = () => {
    const nextIndex = getNextTrackIndex();
    if (nextIndex !== -1 && playlist[nextIndex]) {
      setCurrentTrackIndex(nextIndex);
      setCurrentTrack(playlist[nextIndex]);
      
      // Play next track if user was already playing
      if (isPlaying) {
        setTimeout(async () => {
          const audio = audioRef.current;
          if (audio) {
            try {
              await audio.play();
              setIsPlaying(true);
            } catch (error) {
              console.error('Error playing next track:', error);
              setIsPlaying(false);
            }
          }
        }, 500);
      } else {
        setIsPlaying(false);
      }
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