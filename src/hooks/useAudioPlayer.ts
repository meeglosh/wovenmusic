import { useState, useRef, useEffect, useCallback } from "react";
import { Track } from "@/types/music";

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      console.log('=== LOADING AUDIO ===');
      console.log('Loading track:', currentTrack.title, 'with URL:', currentTrack.fileUrl);
      if (currentTrack.fileUrl === '#' || !currentTrack.fileUrl) {
        console.warn('Track has invalid file URL:', currentTrack.fileUrl);
        return;
      }
      
      const audio = audioRef.current;
      
      // Add event listeners for debugging
      const handleLoadStart = () => console.log('Audio: loadstart event');
      const handleLoadedData = () => console.log('Audio: loadeddata event');
      const handleCanPlay = () => console.log('Audio: canplay event');
      const handleError = (e) => console.error('Audio: error event', e, audio.error);
      const handleLoadedMetadata = () => console.log('Audio: loadedmetadata event');
      
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('loadeddata', handleLoadedData);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      audio.src = currentTrack.fileUrl;
      console.log('Audio src set to:', audio.src);
      audio.load();
      console.log('Audio.load() called');
      
      // Cleanup listeners when component unmounts or track changes
      return () => {
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('loadeddata', handleLoadedData);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playTrack = useCallback((track: Track) => {
    console.log('=== PLAY TRACK DEBUG ===');
    console.log('Track object:', track);
    console.log('Track title:', track.title);
    console.log('Track fileUrl:', track.fileUrl);
    console.log('Track fileUrl type:', typeof track.fileUrl);
    console.log('Is fileUrl valid?', track.fileUrl && track.fileUrl !== '#');
    
    if (!track.fileUrl || track.fileUrl === '#') {
      console.error('Cannot play track - invalid or missing file URL:', track.fileUrl);
      return;
    }
    setCurrentTrack(track);
    setIsPlaying(true);
    
    // Try to play immediately after setting the track
    setTimeout(() => {
      if (audioRef.current) {
        console.log('=== ATTEMPTING AUTO-PLAY ===');
        audioRef.current.play().catch(error => {
          console.error('Auto-play failed:', error);
          setIsPlaying(false);
        });
      }
    }, 100);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) {
      console.warn('Audio element not available');
      return;
    }
    
    if (!currentTrack || !currentTrack.fileUrl || currentTrack.fileUrl === '#') {
      console.error('Cannot play - no valid track or file URL');
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [isPlaying, currentTrack]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioRef,
    playTrack,
    togglePlayPause,
    seekTo,
    setVolume,
    formatTime
  };
};