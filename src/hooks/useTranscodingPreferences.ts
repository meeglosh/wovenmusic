import { useState, useEffect } from 'react';

export type TranscodingFormat = 'mp3' | 'aac';

interface TranscodingPreferences {
  outputFormat: TranscodingFormat;
}

const DEFAULT_PREFERENCES: TranscodingPreferences = {
  outputFormat: 'mp3'
};

const STORAGE_KEY = 'wovenmusic-transcoding-preferences';

export function useTranscodingPreferences() {
  const [preferences, setPreferences] = useState<TranscodingPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TranscodingPreferences;
        console.log('Loading transcoding preferences from localStorage:', parsed);
        setPreferences(parsed);
      }
    } catch (error) {
      console.warn('Failed to load transcoding preferences from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    if (!isLoaded) return; // Don't save during initial load
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      console.log('Saved transcoding preferences to localStorage:', preferences);
    } catch (error) {
      console.warn('Failed to save transcoding preferences to localStorage:', error);
    }
  }, [preferences, isLoaded]);

  const updateOutputFormat = (format: TranscodingFormat) => {
    setPreferences(prev => ({ ...prev, outputFormat: format }));
  };

  return {
    preferences,
    updateOutputFormat,
    isLoaded
  };
}