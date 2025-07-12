import { useState, useEffect } from 'react';

export type Theme = 'neon-garden' | 'midnight-glow' | 'royal-parchment' | 'violet-dreams';

export const THEMES = [
  { value: 'neon-garden', label: 'Neon Garden', description: 'Electric vibes with navy on bright yellow-green' },
  { value: 'midnight-glow', label: 'Midnight Glow', description: 'Deep ocean with glowing accents' },
  { value: 'royal-parchment', label: 'Royal Parchment', description: 'Elegant purple on cream canvas' },
  { value: 'violet-dreams', label: 'Violet Dreams', description: 'Dreamy cream on rich violet' },
] as const;

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('midnight-glow');

  useEffect(() => {
    // Get saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme && THEMES.some(t => t.value === savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Remove old theme classes and apply new theme to document body
    const bodyClasses = document.body.className.split(' ').filter(cls => 
      !THEMES.some(t => t.value === cls)
    );
    document.body.className = [...bodyClasses, theme].join(' ');
    
    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, setTheme, themes: THEMES };
};