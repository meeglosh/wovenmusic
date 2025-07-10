import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/music";

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
      console.log('Audio element created');
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
      try {
        console.log('=== ATTEMPTING TO LOAD TRACK ===');
        console.log('Track file URL:', currentTrack.fileUrl);
        console.log('Dropbox authenticated:', dropboxService.isAuthenticated());
        
        let audioUrl = currentTrack.fileUrl;
        
        // Handle Dropbox URLs by using Dropbox API to get temporary download links
        if (audioUrl.includes('dropbox') && audioUrl.includes('dl.dropboxusercontent.com')) {
          console.log('Converting Dropbox shared URL to temporary download link');
          
          // Check if user is authenticated with Dropbox
          if (!dropboxService.isAuthenticated()) {
            console.error('User not authenticated with Dropbox');
            throw new Error('Please connect to Dropbox first to play music files');
          }
          
          try {
            // Extract the file path from the shared URL
            // For now, let's get the file name from the track and find it in Dropbox
            const fileName = currentTrack.title + '.mp3'; // Assuming mp3 format
            console.log('Searching for file:', fileName);
            
            // List files to find the one that matches
            const files = await dropboxService.listFiles('/Music'); // Assuming files are in /Music folder
            let matchingFile = files.find(file => 
              file['.tag'] === 'file' && // Only look for actual files
              (file.name.toLowerCase().includes(currentTrack.title.toLowerCase()) ||
               file.name.toLowerCase().includes(currentTrack.artist.toLowerCase())) &&
              // Check for audio file extensions
              /\.(mp3|wav|m4a|flac|aac|ogg|wma)$/i.test(file.name)
            );
            
            // If no direct file match, look for a folder that matches and search inside it
            if (!matchingFile) {
              const matchingFolder = files.find(file => 
                file['.tag'] === 'folder' && 
                (file.name.toLowerCase().includes(currentTrack.title.toLowerCase()) ||
                 file.name.toLowerCase().includes(currentTrack.artist.toLowerCase()))
              );
              
              if (matchingFolder) {
                console.log('Found matching folder, searching inside:', matchingFolder.path_lower);
                const folderFiles = await dropboxService.listFiles(matchingFolder.path_lower);
                
                // Try to find a file that matches both the track title AND artist
                matchingFile = folderFiles.find(file => 
                  file['.tag'] === 'file' && 
                  /\.(mp3|wav|m4a|flac|aac|ogg|wma)$/i.test(file.name) &&
                  (file.name.toLowerCase().includes(currentTrack.title.toLowerCase()) ||
                   file.name.toLowerCase().includes(currentTrack.artist.toLowerCase()))
                );
                
                // If no specific match, get the first audio file
                if (!matchingFile) {
                  matchingFile = folderFiles.find(file => 
                    file['.tag'] === 'file' && 
                    /\.(mp3|wav|m4a|flac|aac|ogg|wma)$/i.test(file.name)
                  );
                  console.log('No specific match found, using first audio file in folder:', matchingFile?.path_lower);
                } else {
                  console.log('Found specific matching audio file:', matchingFile?.path_lower);
                }
              }
            }
            
            if (matchingFile) {
              console.log('Found matching audio file:', matchingFile.path_lower);
              const tempLink = await dropboxService.getTemporaryLink(matchingFile.path_lower);
              console.log('Got temporary download link:', tempLink);
              audioUrl = tempLink;
            } else {
              console.log('No matching audio file found, trying fallback approach');
              throw new Error('No matching audio file found in Dropbox');
            }
            
          } catch (error) {
            console.error('Failed to get Dropbox temporary link:', error);
            throw new Error('Failed to load audio from Dropbox. Please check your Dropbox connection.');
          }
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
        
        console.log('Starting audio load...');
        audio.load();
        await loadPromise;
        console.log('Audio loaded successfully!');
        
        // Auto-play after successful load
        setTimeout(() => {
          console.log('Attempting to auto-play after load...');
          audio.play().catch((error) => {
            console.error('Auto-play failed:', error);
          });
          setIsPlaying(true);
        }, 100);
        
      } catch (error) {
        console.error('Failed to load track:', error);
        // You could show a toast notification here
      }
    };
    
    loadTrack();
  }, [currentTrack]); // Make sure we include currentTrack in dependencies

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