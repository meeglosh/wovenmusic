
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
import ProtectedRoute from "./components/ProtectedRoute";
import ProfileProtectedRoute from "./components/ProfileProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/verify" element={<AuthVerify />} />
              <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/members" element={<ProfileProtectedRoute><Members /></ProfileProtectedRoute>} />
              <Route path="/dropbox-callback" element={<DropboxCallback />} />
              <Route path="/track/:trackId" element={<ProfileProtectedRoute><TrackView /></ProfileProtectedRoute>} />
              <Route path="/privacy-settings" element={<ProfileProtectedRoute><PrivacySettings /></ProfileProtectedRoute>} />
              <Route path="/" element={<ProfileProtectedRoute><Index /></ProfileProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
