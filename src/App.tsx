
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes - NO AuthProvider wrapper */}
            <Route path="/playlist/shared" element={
              <>
                {console.log("Route matched: /playlist/shared")}
                <Toaster />
                <Sonner />
                <PublicPlaylist />
              </>
            } />
            <Route path="/playlist/:playlistId" element={
              <>
                <Toaster />
                <Sonner />
                <PublicPlaylist />
              </>
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
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
