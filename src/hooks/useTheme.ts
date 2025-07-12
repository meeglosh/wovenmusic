import { useState, useEffect } from 'react';

export const useTheme = () => {
  const [theme, setTheme] = useState<'combo-1' | 'combo-2'>('combo-1');

  useEffect(() => {
    // Get saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'combo-1' | 'combo-2' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme to document body
    document.body.className = document.body.className.replace(/combo-[12]/, '') + ` ${theme}`;
    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'combo-1' ? 'combo-2' : 'combo-1');
  };

  return { theme, toggleTheme };
};