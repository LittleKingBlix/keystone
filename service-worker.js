// ============================================================
// Keystone service worker
// Caches the app shell for offline use. Network-first for HTML
// (so updates roll out immediately when you ship), cache-first
// for everything else (icons, scripts, styles, fonts).
// ============================================================

const CACHE_NAME = 'keystone-v0.3.0-consistency';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css?v=0.2.4',
  './app.js?v=0.2.4',
  './streak.js?v=0.2.4',
  './manifest.json',
  './rules.md',
  './icon-180.png?v=0.2.4',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png',
];

self.addEventListener('install', e => {
  // Use Promise.allSettled instead of addAll so that one bad asset
  // (e.g. a transient 404 during deploy) doesn't fail the whole install
  // and leave the previous SW wedged in control.
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.allSettled(SHELL_ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first for the HTML shell (so you see new builds right away).
  const isShell =
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html');

  if (isShell) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (assets, fonts, icons).
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(r => {
        // Opportunistically cache same-origin responses
        if (url.origin === self.location.origin && r.ok) {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return r;
      });
    })
  );
});
