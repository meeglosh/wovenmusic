// Configuration constants for the application
export const CONFIG = {
  // Use environment variable if available, otherwise fall back to production domain
  BASE_URL: typeof window !== 'undefined' 
    ? (window as any).__APP_BASE_URL__ || 'https://wovenmusic.app'
    : 'https://wovenmusic.app',
  
  // Supabase configuration
  SUPABASE_URL: "https://woakvdhlpludrttjixxq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYWt2ZGhscGx1ZHJ0dGppeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMjMwODEsImV4cCI6MjA2NjY5OTA4MX0.TklesWo8b-lZW2SsE39icrcC0Y8ho5xzGUdj9MZg-Xg"
} as const;

// Helper functions for URL generation
export const generatePlaylistUrl = (shareToken: string, playlistId?: string) => {
  if (shareToken) {
    return `${CONFIG.BASE_URL}/?playlist=${shareToken}`;
  }
  return `${CONFIG.BASE_URL}/playlist/${playlistId}`;
};

export const generatePlaylistShareUrl = (shareToken: string, playlistId?: string) => {
  if (shareToken) {
    return `${CONFIG.BASE_URL}/playlist/shared?token=${shareToken}`;
  }
  return `${CONFIG.BASE_URL}/playlist/${playlistId}`;
};

export const generateCommentUrl = (shareToken: string) => {
  return `${CONFIG.BASE_URL}/?playlist=${shareToken}#comments`;
};

export const generateAuthUrl = (token: string) => {
  return `${CONFIG.BASE_URL}/auth?token=${token}`;
};