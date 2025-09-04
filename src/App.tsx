import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import CloudflareTest from "@/pages/CloudflareTest";
import NotFound from "@/pages/NotFound";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { pwaService } from "@/services/pwaService";
import { supabase } from "@/integrations/supabase/client";
import "./App.css";

const queryClient = new QueryClient();

/**
 * Public root redirect:
 * - If signed in -> /playlists
 * - If signed out -> /auth
 * (Prevents premature redirects to /profile-setup when simply landing on "/")
 */
function RootRedirect() {
  const [ready, setReady] = useState(false);
  const [to, setTo] = useState<string>("/auth");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setTo(data.session ? "/playlists" : "/auth");
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null; // or a tiny spinner
  return <Navigate to={to} replace />;
}

function App() {
  useEffect(() => {
    // TEMP debug
    console.log("CDN base:", import.meta.env.VITE_CDN_BASE);
    pwaService.init().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <ErrorBoundary>
                <OfflineBanner />
                <PWAInstallPrompt />
                <Routes>
                  {/* Public routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/verify" element={<AuthVerify />} />
                  {/* Support both styles: /playlist/:shareToken and /playlist/shared?token=... */}
                  <Route path="/playlist/:shareToken" element={<PublicPlaylist />} />
                  <Route path="/playlist/shared" element={<PublicPlaylist />} />
                  <Route path="/test-public-playlist" element={<TestPublicPlaylist />} />
                  <Route path="/dropbox-callback" element={<DropboxCallback />} />
                  <Route path="/dropbox/callback" element={<DropboxCallback />} />
                  <Route path="/cloudflare-test" element={<CloudflareTest />} />

                  {/* Public landing – decide based on session only */}
                  <Route path="/" element={<RootRedirect />} />

                  {/* Protected routes */}
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
                  {/* Allow authenticated users without profile to reach setup */}
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
              </ErrorBoundary>
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
