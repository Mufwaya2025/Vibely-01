const CACHE_NAME = 'vibely-cache-v2';
const IMMUTABLE_CACHE_NAME = 'vibely-immutable-cache-v2';

// URLs that are part of the "app shell" and should be cached on install.
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strategy for images: Cache First.
  // This is critical for offline ticket viewing. Once an image is seen online, it's cached.
  if (requestUrl.hostname === 'images.unsplash.com') {
    event.respondWith(
      caches.open(IMMUTABLE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        try {
          const networkResponse = await fetch(event.request);
          // Check if we received a valid response to cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.error('Service Worker: Fetching image failed:', error);
          // Optional: return a placeholder image if fetch fails
        }
      })
    );
    return;
  }
  
  // Strategy for other requests: Network First, then Cache.
  // This ensures users get the most up-to-date data if they are online.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If the request is successful, update the cache.
        // This is important for the app shell files.
        if (response && response.status === 200 && APP_SHELL_URLS.includes(requestUrl.pathname)) {
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, response.clone());
            });
        }
        return response;
      })
      .catch(() => {
        // If the network fails, try to serve from the cache.
        return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // If not in cache and network fails, there's not much we can do.
            // A dedicated offline page could be returned here.
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, IMMUTABLE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
