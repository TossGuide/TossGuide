/**
 * Trashify service worker (offline mode). Plain JS on purpose: it's copied as-is,
 * with the precache list and version injected at build time (build/offline-plugin.ts).
 *
 * Strategy:
 * - App shell (HTML, JS, CSS, fonts, icons, ONNX Runtime WASM): precached on install.
 * - Page navigations: network first (so a new deploy shows up), cached index offline.
 * - Other same-origin GETs: cache first, then network (and cache the response).
 * - /api/*: never cached; the app handles "leaderboard offline" itself.
 * - Model weights from Hugging Face: Transformers.js already keeps them in its own
 *   Cache Storage ("transformers-cache") and reads that first, so we leave them alone.
 */
const PRECACHE = self.__PRECACHE__;
const VERSION = self.__VERSION__;
const SHELL = `trashify-shell-${VERSION}`;
const RUNTIME = `trashify-runtime-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Also clears caches from before the rename (the app used to be "BinSight").
            .filter((k) => (k.startsWith('trashify-') || k.startsWith('binsight-')) && k !== SHELL && k !== RUNTIME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Hub model files etc.
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/', { cacheName: SHELL }).then((r) => r || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
