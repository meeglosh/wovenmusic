import { useState, useEffect } from 'react';

export type Theme = 'neon-garden' | 'midnight-glow' | 'royal-parchment' | 'violet-dreams';

export const THEMES = [
  { value: 'neon-garden', label: 'Xerophyte Resonance', description: 'Electric frequencies on luminous void' },
  { value: 'midnight-glow', label: 'Abyssal Phosphene', description: 'Bioluminescent signals in deep current' },
  { value: 'royal-parchment', label: 'Vellum Transcendence', description: 'Ancient wisdom on ethereal substrate' },
  { value: 'violet-dreams', label: 'Oneiric Spectrum', description: 'Dream particles in chromatic suspension' },
] as const;

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('neon-garden');

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