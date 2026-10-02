// Elimu Kenya service worker
// Change this version every time you upload new files, so phones fetch them.
const CACHE = 'elimu-kenya-v4';

const SHELL = [
  './',
  'index.html',
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'data/data.json',
  'data/extras.json',
  'data/private.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // Add files one by one so a single missing file doesn't break the install
      Promise.all(SHELL.map(url => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first: you always get the newest files when online,
// and the cached copy when offline.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('index.html'))
      )
  );
});
