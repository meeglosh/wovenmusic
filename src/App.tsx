
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthVerify from "./pages/AuthVerify";
import Members from "./pages/Members";
import ProfileSetup from "./pages/ProfileSetup";
import DropboxCallback from "./pages/DropboxCallback";
import NotFound from "./pages/NotFound";
import TrackView from "./pages/TrackView";
import PrivacySettings from "./pages/PrivacySettings";
import PublicPlaylist from "./pages/PublicPlaylist";
import TestPublicPlaylist from "./pages/TestPublicPlaylist";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfileProtectedRoute from "./components/ProfileProtectedRoute";
import ClosedBetaSplash from "./components/ClosedBetaSplash";
import { useClosedBeta } from "./hooks/useClosedBeta";

const queryClient = new QueryClient();

// Wrapper component to handle closed beta logic
const AppContent = () => {
  const location = useLocation();
  const { isClosedBeta, isRouteAllowed } = useClosedBeta();

  // During closed beta, check if route should be protected
  if (isClosedBeta && !isRouteAllowed(location.pathname)) {
    return (
      <>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <ClosedBetaProtectedRoute />
        </AuthProvider>
      </>
    );
  }

  return (
    <Routes>
      {/* Public routes during closed beta become protected */}
      <Route path="/playlist/shared" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          {isClosedBeta ? (
            <ProtectedRoute><PublicPlaylist /></ProtectedRoute>
          ) : (
            <PublicPlaylist />
          )}
        </AuthProvider>
      } />
      <Route path="/playlist/:playlistId" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          {isClosedBeta ? (
            <ProtectedRoute><PublicPlaylist /></ProtectedRoute>
          ) : (
            <PublicPlaylist />
          )}
        </AuthProvider>
      } />
      
      {/* Protected routes with AuthProvider wrapper */}
      <Route path="/auth" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Auth />
        </AuthProvider>
      } />
      <Route path="/auth/verify" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AuthVerify />
        </AuthProvider>
      } />
      <Route path="/profile-setup" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <ProtectedRoute><ProfileSetup /></ProtectedRoute>
        </AuthProvider>
      } />
      <Route path="/members" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <ProfileProtectedRoute><Members /></ProfileProtectedRoute>
        </AuthProvider>
      } />
      <Route path="/dropbox-callback" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <DropboxCallback />
        </AuthProvider>
      } />
      <Route path="/track/:trackId" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <ProfileProtectedRoute><TrackView /></ProfileProtectedRoute>
        </AuthProvider>
      } />
      <Route path="/privacy-settings" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <ProfileProtectedRoute><PrivacySettings /></ProfileProtectedRoute>
        </AuthProvider>
      } />
      <Route path="/" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <ProfileProtectedRoute><Index /></ProfileProtectedRoute>
        </AuthProvider>
      } />
      <Route path="*" element={
        <AuthProvider>
          <Toaster />
          <Sonner />
          <NotFound />
        </AuthProvider>
      } />
    </Routes>
  );
};

// Component to handle showing splash screen vs redirecting authenticated users
const ClosedBetaProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, redirect them to the main app
  if (user) {
    return <ProfileProtectedRoute><Index /></ProfileProtectedRoute>;
  }

  // Show closed beta splash for non-authenticated users
  return <ClosedBetaSplash />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
