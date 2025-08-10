
import React, { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { pwaService } from "@/services/pwaService";

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for PWA updates
    const handlePWAEvent = (event: any) => {
      if (event.type === 'UPDATE_AVAILABLE') {
        setUpdateAvailable(true);
        setShowUpdatePrompt(true);
      }
    };

    pwaService.addEventListener(handlePWAEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      pwaService.removeEventListener(handlePWAEvent);
    };
  }, []);

  const handleUpdateApp = () => {
    pwaService.activateUpdate();
  };

  const dismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  // Don't show anything if we're online and no updates
  if (isOnline && !showUpdatePrompt) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-4xl mx-auto">
        {/* Offline Banner */}
        {!isOnline && (
          <Alert className="mb-2 bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800">
            <WifiOff className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              You're offline. Some features may be limited. Downloaded tracks will still play.
            </AlertDescription>
          </Alert>
        )}

        {/* Update Available Banner */}
        {showUpdatePrompt && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 flex items-center justify-between">
              <span>A new version is available!</span>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={dismissUpdate}
                  className="text-xs"
                >
                  Later
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateApp}
                  className="text-xs"
                >
                  Update Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
