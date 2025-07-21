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

// Component to handle closed beta logic with authentication awareness
const ClosedBetaChecker = ({ isClosedBeta, isRouteAllowed, location }: { isClosedBeta: boolean, isRouteAllowed: (pathname: string, isAuthenticated?: boolean) => boolean, location: any }) => {
  const { user, loading } = useAuth();

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

  // During closed beta, check if route should be protected
  if (isClosedBeta && !isRouteAllowed(location.pathname, !!user)) {
    // Show closed beta splash for non-authenticated users
    return <ClosedBetaSplash />;
  }

  return <AppRoutes isClosedBeta={isClosedBeta} />;
};

// Main routing component
const AppRoutes = ({ isClosedBeta }: { isClosedBeta: boolean }) => {
  return (
    <Routes>
      {/* Public routes during closed beta become protected */}
      <Route path="/playlist/shared" element={
        isClosedBeta ? (
          <ProtectedRoute><PublicPlaylist /></ProtectedRoute>
        ) : (
          <PublicPlaylist />
        )
      } />
      <Route path="/playlist/:playlistId" element={
        isClosedBeta ? (
          <ProtectedRoute><PublicPlaylist /></ProtectedRoute>
        ) : (
          <PublicPlaylist />
        )
      } />
      
      {/* Protected routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/verify" element={<AuthVerify />} />
      <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
      <Route path="/members" element={<ProfileProtectedRoute><Members /></ProfileProtectedRoute>} />
      <Route path="/dropbox-callback" element={<DropboxCallback />} />
      <Route path="/track/:trackId" element={<ProfileProtectedRoute><TrackView /></ProfileProtectedRoute>} />
      <Route path="/privacy-settings" element={<ProfileProtectedRoute><PrivacySettings /></ProfileProtectedRoute>} />
      <Route path="/" element={<ProfileProtectedRoute><Index /></ProfileProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Wrapper component to handle closed beta logic
const AppContent = () => {
  const location = useLocation();
  const { isClosedBeta, isRouteAllowed } = useClosedBeta();

  return (
    <AuthProvider>
      <Toaster />
      <Sonner />
      <ClosedBetaChecker isClosedBeta={isClosedBeta} isRouteAllowed={isRouteAllowed} location={location} />
    </AuthProvider>
  );
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