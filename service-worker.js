
const CACHE_NAME = 'mythos-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './quotes.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/mockups/mug.png',
  './assets/mockups/tshirt.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  // Network falling back to cache for JSON; cache-first for static
  if (ASSETS.some(a => request.url.includes(a))) {
    event.respondWith(caches.match(request).then(res => res || fetch(request)));
  } else {
    event.respondWith(
      fetch(request).then(res => {
        // Optionally cache new GET requests
        if (request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return res;
      }).catch(() => caches.match(request))
    );
  }
});
