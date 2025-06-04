// sw.js
const CACHE_NAME = 'sbtexto-v3'; // Increment version if you change cached files significantly
const urlsToCache = [
  './', // Alias for index.html in the root
  './index.html', // Explicitly cache index.html
  './logo.png',
  // Google Fonts CSS files (these will in turn request .woff2 files)
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@100..900&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap',
];

// Install event: Open cache and add core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        const requests = urlsToCache.map(url => {
            // For cross-origin requests (like Google Fonts CSS), use 'no-cors' mode.
            // This will store an "opaque" response. We can't inspect it, but it works for caching.
            if (url.startsWith('http')) {
                return new Request(url, { mode: 'no-cors' });
            }
            return url;
        });
        return cache.addAll(requests)
            .then(() => console.log('Core assets cached.'))
            .catch(error => console.error('Failed to cache core assets:', error));
      })
  );
});

// Fetch event: Serve from cache if available, otherwise fetch from network and cache
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Strategy for Google Fonts API (CSS) and font files (gstatic.com)
  // Cache-first, then network fallback for these
  if (requestUrl.origin === 'https://fonts.googleapis.com' || requestUrl.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // For opaque responses (from no-cors for cross-origin), status is 0.
            // Cache valid responses (200) or opaque responses.
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            console.warn(`SW: Fetch failed for ${event.request.url}; Error: ${error}`);
            // If fetch fails and there's a cachedResponse, it will be returned.
            // If no cachedResponse and fetch fails, this will propagate the error.
            // For fonts, this is usually acceptable (browser might use fallbacks).
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return; // Done handling font requests
  }

  // Default: Cache-then-Network strategy for other requests (app shell, local assets)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse; // Serve from cache
      }
      // If not in cache, fetch from network
      return fetch(event.request).then(
        networkResponse => {
          // Check if we received a valid response to cache
          // Don't cache chrome-extension errors or other outright errors.
          // Opaque responses are okay to cache.
          if (!networkResponse || 
              (networkResponse.status !== 200 && networkResponse.type !== 'opaque') ||
              (networkResponse.type === 'error' && !event.request.url.startsWith('chrome-extension://'))) {
            return networkResponse; // Don't cache bad responses
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return networkResponse;
        }
      ).catch(error => {
        console.error(`SW: Fetch failed for ${event.request.url}. Error: ${error}`);
        // Optionally, return a generic offline page if specific assets fail and are critical,
        // but for this SPA, if index.html is cached, it should mostly work.
        // if (event.request.mode === 'navigate') {
        //   return caches.match('/offline-fallback.html'); // You'd need to cache this fallback
        // }
      });
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
