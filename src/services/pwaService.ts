
interface PWAUpdateAvailableEvent {
  type: 'UPDATE_AVAILABLE';
  registration: ServiceWorkerRegistration;
}

interface PWAInstalledEvent {
  type: 'INSTALLED';
}

interface PWAOfflineEvent {
  type: 'OFFLINE_READY';
}

type PWAEvent = PWAUpdateAvailableEvent | PWAInstalledEvent | PWAOfflineEvent;

class PWAService {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private listeners: Array<(event: PWAEvent) => void> = [];

  async init(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Workers not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully');

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            this.updateAvailable = true;
            this.notifyListeners({
              type: 'UPDATE_AVAILABLE',
              registration: this.registration!
            });
          } else if (newWorker.state === 'installed') {
            // First install
            this.notifyListeners({
              type: 'INSTALLED'
            });
          }
        });
      });

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SW_ACTIVATED') {
          this.notifyListeners({
            type: 'OFFLINE_READY'
          });
        }
      });

      // Check if there's already a waiting service worker
      if (this.registration.waiting) {
        this.updateAvailable = true;
        this.notifyListeners({
          type: 'UPDATE_AVAILABLE',
          registration: this.registration
        });
      }

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  activateUpdate(): void {
    if (!this.registration?.waiting) return;

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page to get the new version
    window.location.reload();
  }

  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  addEventListener(listener: (event: PWAEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (event: PWAEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(event: PWAEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in PWA event listener:', error);
      }
    });
  }

  // Check if app can be installed
  canInstall(): boolean {
    return 'beforeinstallprompt' in window;
  }

  // Prompt for installation
  async promptInstall(deferredPrompt: any): Promise<boolean> {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    return outcome === 'accepted';
  }
}

export const pwaService = new PWAService();

// Utility to check if we're running as a PWA
export const isPWA = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         // @ts-ignore
         window.navigator.standalone === true;
};

// Utility to check online status
export const isOnlineWithConnectivity = (): boolean => {
  return navigator.onLine;
};
