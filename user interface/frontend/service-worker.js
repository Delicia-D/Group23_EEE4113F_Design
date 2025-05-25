const APP_CACHE_NAME = 'penguin-monitor-v3';
const API_CACHE_NAME = 'penguin-api-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/signup.html',
  '/upload.html',
  '/tets.html',
  '/admin/admin-approval.html',
  '/admin/admin-login.html',
  '/analytics/analytics.html',
  '/analytics/analytics.css',
  '/analytics/analytics.js',
  '/analytics/light-mode-analytics.css',
  '/upload.css',
  '/upload-light.css',
  '/style.css',
  '/style1.css',
  '/light-mode.css',
  '/script.js',
  '/upload.js',
  '/manifest.json',
  '/test.jpeg',
  '/test2.png',
  '/test3.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/penguins',
  /\/penguin\/.*/,
  /\/api\/visit-count/
];

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('Assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Error caching assets:', error);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== APP_CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - Handle all requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
   if (!navigator.onLine) {
    // Send a message to all clients when serving offline content
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'OFFLINE_STATUS',
          isOffline: true
        });
      });
    });
  }
  // Skip non-GET requests, chrome-extension requests, and some other protocols
  if (request.method !== 'GET' || 
      request.url.startsWith('chrome-extension://') ||
      request.url.startsWith('moz-extension://') ||
      request.url.startsWith('ms-browser-extension://') ||
      url.protocol === 'chrome-extension:' ||
      url.protocol === 'moz-extension:' ||
      url.protocol === 'ms-browser-extension:') {
    return;
  }

  // Handle API requests
  if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static asset requests with Cache First strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Serving from cache:', request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('Fetching from network:', request.url);
        return fetchAndCache(request, APP_CACHE_NAME);
      })
      .catch((error) => {
        console.error('Fetch failed:', error);
        // Return a fallback response for HTML pages
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        throw error;
      })
  );
});

// Helper functions
function isApiRequest(request) {
  return API_ENDPOINTS.some(pattern => {
    if (typeof pattern === 'string') {
      return request.url.includes(pattern);
    } else if (pattern instanceof RegExp) {
      return pattern.test(request.url);
    }
    return false;
  });
}

function handleApiRequest(request) {
  console.log('Handling API request:', request.url);
  
  // Network First strategy for API requests
  return fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        console.log('API request successful, caching response');
        const responseToCache = networkResponse.clone();
        caches.open(API_CACHE_NAME)
          .then((cache) => cache.put(request, responseToCache))
          .catch((error) => console.error('Error caching API response:', error));
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('Network failed for API request, trying cache');
      // Network failed - try cache
      return caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Serving API response from cache');
            return cachedResponse;
          }
          
          // No cache available - return offline fallback
          console.log('No cached API response available');
          return new Response(
            JSON.stringify({ 
              error: true,
              message: "You're offline and no cached data is available",
              suggestion: "Try again when you have an internet connection"
            }), 
            { 
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              } 
            }
          );
        });
    });
}

function fetchAndCache(request, cacheName) {
  return fetch(request)
    .then((response) => {
      // Check if we received a valid response
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }

      // Clone the response to cache it
      const responseToCache = response.clone();
      caches.open(cacheName)
        .then((cache) => {
          cache.put(request, responseToCache);
          console.log('Cached new resource:', request.url);
        })
        .catch((error) => console.error('Error caching resource:', error));

      return response;
    });
}

// Message handling for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Force cache update
    event.waitUntil(
      caches.open(APP_CACHE_NAME).then(cache => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
    );
  }
});

