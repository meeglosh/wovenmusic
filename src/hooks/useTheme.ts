import { useState, useEffect } from 'react';

export type Theme = 'midnight-glow' | 'neon-garden' | 'royal-parchment' | 'violet-dreams' | 'glacial-syntax' | 'cryogenic-resonance' | 'aureate-membrane' | 'liminal-aureole' | 'umbral-manuscript' | 'spectral-palimpsest' | 'chromatic-nexus' | 'magenta-oscillation' | 'silurian-threshold' | 'cambrian-resonance';

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
  { value: 'silurian-threshold', label: 'Paleozoic Stratum', description: 'Ancient sediments in temporal layers' },
  { value: 'cambrian-resonance', label: 'Primordial Echo', description: 'Fossil vibrations in stone matrix' },
] as const;

export const useTheme = () => {
  // Initialize with null to avoid overriding localStorage value
  const [theme, setTheme] = useState<Theme | null>(null);

  // Load theme from localStorage on mount
  useEffect(() => {
    const loadTheme = () => {
      try {
        const savedTheme = localStorage.getItem('wovenmusic-theme') as Theme | null;
        
        console.log('Loading theme from localStorage:', savedTheme);
        
        // Validate that the saved theme exists in our theme list
        if (savedTheme && THEMES.some(t => t.value === savedTheme)) {
          console.log('Setting valid saved theme:', savedTheme);
          setTheme(savedTheme);
          // Apply theme immediately to prevent flash
          applyThemeToBody(savedTheme);
        } else {
          console.log('No valid saved theme, setting default');
          // Set default theme if no valid saved theme
          setTheme('midnight-glow');
          applyThemeToBody('midnight-glow');
        }
      } catch (error) {
        console.warn('Failed to load theme from localStorage:', error);
        setTheme('midnight-glow');
        applyThemeToBody('midnight-glow');
      }
    };

    loadTheme();
  }, []);

  // Apply theme to body and save to localStorage when theme changes
  useEffect(() => {
    if (theme) {
      applyThemeToBody(theme);
      
      // Save theme to localStorage with error handling
      try {
        localStorage.setItem('wovenmusic-theme', theme);
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error);
      }
    }
  }, [theme]);

  const applyThemeToBody = (selectedTheme: Theme) => {
    // Remove all existing theme classes
    const bodyClasses = document.body.className.split(' ').filter(cls => 
      !THEMES.some(t => t.value === cls)
    );
    
    // Add the selected theme class
    document.body.className = [...bodyClasses, selectedTheme].join(' ').trim();
  };

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  // Return null theme until loaded to prevent flash
  return { 
    theme: theme || 'midnight-glow', 
    setTheme: changeTheme, 
    themes: THEMES,
    isThemeLoaded: theme !== null
  };
};