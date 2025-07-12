import { useTheme } from "@/hooks/useTheme";
import { useEffect } from "react";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { theme, isThemeLoaded } = useTheme();

  // This component ensures the theme hook is initialized
  useEffect(() => {
    // Theme hook will run its initialization effect
  }, []);

  return <>{children}</>;
};