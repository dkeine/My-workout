/* Iron Log service worker (IL-03): precache the app shell, serve
   cache-first. The empire does not pause for bad reception. */

const CACHE = 'ironlog-v2';
const ASSETS = [
  './',
  'index.html',
  'poster.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/i18n.js',
  'js/data.js',
  'js/state.js',
  'js/qr.js',
  'js/share.js',
  'js/importers.js',
  'js/card.js',
  'js/voice.js',
  'js/ui.js',
  'js/app.js',
  'fonts/bebas-neue.woff2',
  'fonts/manrope.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'favicon.ico',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return;
  ev.respondWith(
    caches.match(ev.request, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(ev.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(ev.request, copy));
        }
        return res;
      }).catch(() => (ev.request.mode === 'navigate' ? caches.match('index.html') : undefined))
    )
  );
});
