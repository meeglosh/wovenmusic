import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";

// Import the existing DropboxService
import { DropboxService } from "@/services/dropboxService";

const dropboxService = new DropboxService();

// Shuffle function using Fisher-Yates algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Playlist functionality
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [isRepeatMode, setIsRepeatMode] = useState(false);

  // Create or get the audio element
  useEffect(() => {
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;
    }
  }, []);

  // Track loading and metadata
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    console.log('=== LOADING TRACK ===');
    console.log('Track:', currentTrack.title);
    console.log('URL:', currentTrack.fileUrl);

    const loadTrack = async () => {
      try {
        console.log('=== ATTEMPTING TO LOAD TRACK ===');
        console.log('Track file URL:', currentTrack.fileUrl);
        console.log('Dropbox authenticated:', dropboxService.isAuthenticated());
        
        let audioUrl = currentTrack.fileUrl;
        
        // Handle Dropbox file paths - generate fresh temporary links
        if (audioUrl.startsWith('/') && dropboxService.isAuthenticated()) {
          console.log('Generating fresh temporary link for Dropbox file:', audioUrl);
          try {
            const tempLink = await dropboxService.getTemporaryLink(audioUrl);
            audioUrl = tempLink;
            console.log('Got fresh temporary link:', tempLink);
          } catch (error) {
            console.error('Failed to get fresh temporary link:', error);
            throw new Error('Failed to get playable link from Dropbox');
          }
        } else if (audioUrl.startsWith('/') && !dropboxService.isAuthenticated()) {
          console.error('Dropbox file detected but not authenticated');
          throw new Error('Dropbox authentication required to play this track');
        } else if (audioUrl.includes('dropbox') && audioUrl.includes('dl.dropboxusercontent.com')) {
          // Existing temporary link - convert to direct download
          console.log('Converting Dropbox temporary link to direct download');
          
          // Replace the /file suffix and add dl=1 parameter for direct download
          if (audioUrl.endsWith('/file')) {
            audioUrl = audioUrl.replace('/file', '');
          }
          
          // Add or replace dl parameter to force download
          if (audioUrl.includes('?')) {
            audioUrl = audioUrl.replace(/[?&]dl=[01]/, '') + '?dl=1';
          } else {
            audioUrl = audioUrl + '?dl=1';
          }
          
          console.log('Converted Dropbox URL:', audioUrl);
        }

        console.log('Final audio URL:', audioUrl);
        audio.src = audioUrl;
        
        // Create a promise to handle audio loading
        const loadPromise = new Promise((resolve, reject) => {
          const handleCanPlay = () => {
            console.log('Audio can play - track loaded successfully');
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve(true);
          };
          
          const handleError = (e) => {
            console.error('Audio load error:', e);
            console.error('Audio element error code:', audio.error?.code);
            console.error('Audio element error message:', audio.error?.message);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(e);
          };
          
          audio.addEventListener('canplay', handleCanPlay);
          audio.addEventListener('error', handleError);
        });
        
        audio.load();
        await loadPromise;
        
      } catch (error) {
        console.error('Failed to load track:', error);
        // You could show a toast notification here
      }
    };
    
    loadTrack();

    const handleLoadStart = () => console.log('Audio: loadstart event');
    const handleLoadedData = () => console.log('Audio: loadeddata event');
    const handleCanPlay = () => console.log('Audio: canplay event');
    const handleError = (e: any) => console.error('Audio: error event', e);
    const handleLoadedMetadata = () => console.log('Audio: loadedmetadata event');

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [currentTrack]);

  // Time and duration updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
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
  }, [playlist, currentTrackIndex, isShuffleMode, shuffledOrder, isRepeatMode]);

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

    if (!track.fileUrl) {
      console.error('Track has no fileUrl');
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
    setCurrentTrack(trackToPlay);
    
    // Auto-play the first track
    setTimeout(() => {
      console.log('Attempting to auto-play...');
      const audio = audioRef.current;
      if (audio) {
        console.log('Audio element available, calling play()');
        audio.play().catch((error) => {
          console.error('Play failed:', error);
        });
        setIsPlaying(true);
      } else {
        console.error('Audio element not available');
      }
    }, 100);
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('Audio element not available');
      return;
    }

    try {
      if (isPlaying) {
        await audio.pause();
        setIsPlaying(false);
        console.log('Paused audio');
      } else {
        console.log('Attempting to play audio...');
        await audio.play();
        setIsPlaying(true);
        console.log('Playing audio');
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('Auto-play blocked by browser. User interaction required.');
      }
    }
  };

  const playNext = () => {
    const nextIndex = getNextTrackIndex();
    if (nextIndex !== -1 && playlist[nextIndex]) {
      setCurrentTrackIndex(nextIndex);
      setCurrentTrack(playlist[nextIndex]);
      
      // Auto-play next track
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.play().catch(console.error);
          setIsPlaying(true);
        }
      }, 100);
    }
  };

  const playPrevious = () => {
    const prevIndex = getPreviousTrackIndex();
    if (prevIndex !== -1 && playlist[prevIndex]) {
      setCurrentTrackIndex(prevIndex);
      setCurrentTrack(playlist[prevIndex]);
      
      // Auto-play previous track
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.play().catch(console.error);
          setIsPlaying(true);
        }
      }, 100);
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

  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return "0:00";
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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