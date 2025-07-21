import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useClosedBeta = () => {
  const [searchParams] = useSearchParams();
  const [isClosedBeta, setIsClosedBeta] = useState(true);

  useEffect(() => {
    // Check if we're in development or if closed beta is disabled
    const isDevelopment = import.meta.env.DEV;
    const closedBetaDisabled = searchParams.get('closed_beta') === 'false';
    
    // In development, we can disable closed beta for testing
    if (isDevelopment && closedBetaDisabled) {
      setIsClosedBeta(false);
    } else {
      // In production, always respect the closed beta setting
      setIsClosedBeta(true);
    }
  }, [searchParams]);

  // Check if current route should be allowed during closed beta
  const isRouteAllowed = (pathname: string) => {
    const allowedRoutes = [
      '/auth',
      '/auth/verify', 
      '/profile-setup',
      '/dropbox-callback'
    ];
    
    // Allow invitation acceptance routes
    const isInviteRoute = pathname.includes('/invite/') || searchParams.has('token');
    
    return allowedRoutes.includes(pathname) || isInviteRoute;
  };

  return {
    isClosedBeta,
    isRouteAllowed
  };
};