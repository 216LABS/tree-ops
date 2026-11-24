// Tree Ops service worker (adapted from Flake's driver worker). Keeps the crew link page and its scripts available with no
// signal. Crew actions and photos never pass through here: they live in the IndexedDB outbox.
const CACHE = 'treeops-crew-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Signed photo links from storage: freshest with signal, last seen without.
    if (/\/storage\/v1\/object\/sign\//.test(url.pathname)) {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.origin + url.pathname, copy)); }
            return res;
          })
          .catch(() => caches.match(url.origin + url.pathname).then((hit) => hit || new Response('', { status: 503 }))),
      );
    }
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); } return res; })));
    return;
  }
  if (request.mode === 'navigate' && url.pathname.startsWith('/c/')) {
    event.respondWith(
      fetch(request)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); } return res; })
        .catch(() => caches.match(url.pathname).then((hit) => hit || new Response('No signal. Open this link once with signal first.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))),
    );
  }
});
