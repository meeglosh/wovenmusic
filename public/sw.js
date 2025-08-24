
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { skipWaiting, clientsClaim } from 'workbox-core';

// Enable navigation preload for faster loading
if ('navigationPreload' in self.registration) {
  self.registration.navigationPreload.enable();
}

// Skip waiting and claim clients immediately
skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precache app shell - this will be populated by Vite during build
precacheAndRoute(self.__WB_MANIFEST);

// Cache strategies for different asset types

// Playlist cover images from Supabase storage - aggressive caching for instant loading
registerRoute(
  ({ request, url }) => 
    request.destination === 'image' && 
    url.origin.includes('supabase') && 
    url.pathname.includes('storage'),
  new StaleWhileRevalidate({
    cacheName: 'playlist-covers',
    plugins: [{
      cacheKeyWillBeUsed: async ({ request }) => {
        // Create stable cache key based on the base URL without changing transformation params
        const url = new URL(request.url);
        // Keep format, width, height params but normalize them for better cache hits
        const width = url.searchParams.get('width') || '512';
        const height = url.searchParams.get('height') || '512';
        const format = url.searchParams.get('format') || 'webp';
        return `${url.origin}${url.pathname}?width=${width}&height=${height}&format=${format}`;
      },
      cacheWillUpdate: async ({ response }) => {
        // Cache successful responses and common image formats
        return response && response.status === 200 && 
               response.headers.get('content-type')?.startsWith('image/');
      }
    }],
    matchOptions: {
      ignoreVary: true
    }
  })
);

// Static assets from CDNs (fonts, other images, etc.)
registerRoute(
  ({ request, url }) => 
    request.destination === 'font' ||
    (request.destination === 'image' && !url.origin.includes('supabase')) ||
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [{
      cacheKeyWillBeUsed: async ({ request }) => {
        return `${request.url}?v=1`;
      }
    }]
  })
);

// API calls - use NetworkFirst for fresh data when online
registerRoute(
  ({ url }) => 
    url.origin === 'https://woakvdhlpludrttjixxq.supabase.co' &&
    (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        // Only cache successful responses
        return response && response.status === 200;
      }
    }]
  })
);

// Cache JavaScript and CSS from our domain
registerRoute(
  ({ request, url }) => 
    (request.destination === 'script' || request.destination === 'style') &&
    url.origin === self.location.origin,
  new StaleWhileRevalidate({
    cacheName: 'assets-cache'
  })
);

// Don't cache audio files in SW - let our IndexedDB offline storage handle that
registerRoute(
  ({ request }) => request.destination === 'audio',
  new NetworkFirst({
    cacheName: 'audio-fallback',
    plugins: [{
      cacheWillUpdate: async () => {
        // Don't cache audio files in SW - our app handles this
        return false;
      }
    }]
  })
);

// Handle navigation requests - serve app shell when offline
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      // Try network first
      const response = await fetch(event.request);
      return response;
    } catch (error) {
      // If network fails, serve the cached app shell
      const cache = await caches.open('workbox-precache-v2-' + self.location.origin);
      const cachedResponse = await cache.match('/');
      return cachedResponse || new Response('Offline - App shell not available', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  }
);

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients when a new service worker is installed
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // Send a message to all clients about the new SW
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_INSTALLED',
          version: '1.0.0'
        });
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  // Notify clients that the SW is ready
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: '1.0.0'
        });
      });
    })
  );
});
