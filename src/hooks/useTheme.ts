import { useState, useEffect } from 'react';

export type Theme = 'midnight-glow' | 'neon-garden' | 'royal-parchment' | 'violet-dreams' | 'glacial-syntax' | 'cryogenic-resonance' | 'aureate-membrane' | 'liminal-aureole' | 'umbral-manuscript' | 'spectral-palimpsest' | 'chromatic-nexus' | 'magenta-oscillation';

export const THEMES = [
  { value: 'midnight-glow', label: 'Abyssal Phosphene', description: 'Bioluminescent signals in deep current' },
  { value: 'neon-garden', label: 'Xerophyte Resonance', description: 'Electric frequencies on luminous void' },
  { value: 'royal-parchment', label: 'Vellum Transcendence', description: 'Ancient wisdom on ethereal substrate' },
  { value: 'violet-dreams', label: 'Oneiric Spectrum', description: 'Dream particles in chromatic suspension' },
  { value: 'glacial-syntax', label: 'Cryogenic Whisper', description: 'Frozen algorithms in crystalline matrix' },
  { value: 'cryogenic-resonance', label: 'Glacial Syntax', description: 'Sub-zero frequencies in thermal void' },
  { value: 'aureate-membrane', label: 'Liminal Aureole', description: 'Golden halos in transitional space' },
  { value: 'liminal-aureole', label: 'Aureate Membrane', description: 'Threshold barriers in gilded essence' },
  { value: 'umbral-manuscript', label: 'Spectral Palimpsest', description: 'Ghostly text on shadow parchment' },
  { value: 'spectral-palimpsest', label: 'Umbral Manuscript', description: 'Overwritten shadows in phantom ink' },
  { value: 'chromatic-nexus', label: 'Synaptic Magenta', description: 'Neural pathways in violet discharge' },
  { value: 'magenta-oscillation', label: 'Chromatic Nexus', description: 'Color intersections in frequency space' },
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