const CACHE_NAME = 'parmak-futbolu-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/components/GameCanvas.tsx',
  '/components/LeagueTable.tsx',
  '/components/PenaltyShootout.tsx',
  '/components/TournamentBracket.tsx',
  '/constants.ts',
  '/types.ts',
  '/utils/gameModes.ts',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Delete old caches
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
    // For navigation requests, use a network-first strategy.
    // This ensures users get the latest version of the app shell.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // If the network fails, serve the main page from the cache.
                return caches.match('/');
            })
        );
        return;
    }

    // For all other requests (assets like JS, CSS, fonts), use a cache-first strategy.
    // This makes the app load fast and work offline.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // If the resource is in the cache, return it.
            if (cachedResponse) {
                return cachedResponse;
            }

            // If it's not in the cache, fetch it from the network.
            return fetch(event.request).then(networkResponse => {
                // Clone the response and cache it for future use.
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});
