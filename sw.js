// Sama service worker: makes the site installable and lets the home-screen icon open when offline.
// Network first, so a connected phone always gets the newest version; the cache is only a fallback.
const CACHE = 'sama-shell-v2';
const SHELL = ['/', '/fonts/fonts.css', '/icons/sama-192.png', '/favicon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && (r.mode === 'navigate' || SHELL.includes(u.pathname) || /\.(woff2|wasm|js|json|png|svg|mp3|webp)$/.test(u.pathname))){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
