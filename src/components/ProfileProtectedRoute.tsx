import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ProfileProtectedRouteProps {
  children: React.ReactNode;
}

const ProfileProtectedRoute = ({ children }: ProfileProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasCompleteProfile, setHasCompleteProfile] = useState(false);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setProfileLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_band_member')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
          setHasCompleteProfile(false);
        } else if (!profile || !profile.full_name || !profile.role) {
          // Profile doesn't exist or is incomplete
          setHasCompleteProfile(false);
        } else {
          setHasCompleteProfile(true);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        setHasCompleteProfile(false);
      }

      setProfileLoading(false);
    };

    if (!authLoading) {
      checkProfile();
    }
  }, [user, authLoading]);

  // Show loading while checking auth or profile
  if (authLoading || profileLoading) {
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

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to profile setup if profile is incomplete
  if (!hasCompleteProfile) {
    return <Navigate to="/profile-setup" replace />;
  }

  // User is authenticated and has complete profile
  return <>{children}</>;
};

export default ProfileProtectedRoute;