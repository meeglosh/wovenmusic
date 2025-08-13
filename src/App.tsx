
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProfileProtectedRoute from "@/components/ProfileProtectedRoute";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import AuthVerify from "@/pages/AuthVerify";

import { PlaylistViewPage } from "@/pages/PlaylistViewPage";
import PublicPlaylist from "@/pages/PublicPlaylist";
import TestPublicPlaylist from "@/pages/TestPublicPlaylist";
import Members from "@/pages/Members";
import TrackView from "@/pages/TrackView";
import ProfileSetup from "@/pages/ProfileSetup";
import PrivacySettings from "@/pages/PrivacySettings";
import DropboxCallback from "@/pages/DropboxCallback";
import NotFound from "@/pages/NotFound";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { pwaService } from "@/services/pwaService";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Initialize PWA service
    pwaService.init().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <OfflineBanner />
              <PWAInstallPrompt />
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/verify" element={<AuthVerify />} />
                <Route path="/playlist/:shareToken" element={<PublicPlaylist />} />
                <Route path="/test-public-playlist" element={<TestPublicPlaylist />} />
                <Route path="/dropbox/callback" element={<DropboxCallback />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <Navigate to="/playlists" replace />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/library"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <Index />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/playlists"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <Index />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/playlists/:id"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <PlaylistViewPage />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/members"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <Members />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/track/:id"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <TrackView />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile-setup"
                  element={
                    <ProtectedRoute>
                      <ProfileSetup />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/privacy-settings"
                  element={
                    <ProtectedRoute>
                      <ProfileProtectedRoute>
                        <PrivacySettings />
                      </ProfileProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
