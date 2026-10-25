const CACHE = 'cinema-library-shell-v32-cache-safe-20261025';
const SHELL = [
  './', './index.html', './catalog.html', './genres.html', './stream/index.html',
  './404.html', './contribute.html', './manifest.webmanifest',
  './assets/site-shell.css', './assets/site-shell.js', './assets/home-nav-fix.js', './assets/nav-parity.css', './assets/icons/cinema-library-favicon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('message', event => {
  if (event.data?.type === 'cinema:skip-waiting') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  const isShell = url.pathname === '/' || [
    '/index.html', '/catalog.html', '/genres.html', '/stream/index.html',
    '/404.html', '/contribute.html', '/manifest.webmanifest',
    '/assets/site-shell.css', '/assets/site-shell.js', '/assets/home-nav-fix.js', '/assets/nav-parity.css'
  ].includes(url.pathname);
  if (isShell) {
    // Player URLs contain the selected title, episode, server and subtitle.
    // Never cache those dynamic query variants: otherwise a TV cache can grow
    // once per episode and replay the wrong player state after navigation.
    if (url.pathname === '/stream/index.html') {
      event.respondWith(
        fetch(request, { cache: url.searchParams.has('fresh') || request.cache === 'reload' ? 'no-store' : 'default' })
          .catch(() => caches.match(new Request(`${url.origin}${url.pathname}`)).then(cached => cached || caches.match('./404.html')))
      );
      return;
    }
    const cacheOptions = { ignoreSearch: true };
    const forceFresh = url.searchParams.has('fresh') || request.cache === 'reload';
    if (forceFresh) {
      event.respondWith(
        fetch(request, { cache: 'no-store' }).then(response => {
          // Fresh player documents contain title/server query parameters and
          // are intentionally not cached. Caching every TV retry would leave
          // one permanent entry per movie/episode in the shell cache.
          if (response.ok) {
            const cacheKey = new Request(`${url.origin}${url.pathname}`);
            caches.open(CACHE).then(cache => cache.put(cacheKey, response.clone())).catch(() => {});
          }
          return response;
        }).catch(() => caches.match(request, cacheOptions).then(cached => cached || caches.match('./404.html')))
      );
      return;
    }
    event.respondWith(caches.match(request, cacheOptions).then(cached => {
      const refresh = fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(() => {});
        return response;
      }).catch(() => cached || caches.match('./404.html'));
      return cached || refresh;
    }));
    return;
  }
  // Only cache immutable/static assets. Dynamic routes and ad-hoc same-origin
  // requests must not grow the TV cache indefinitely or replay stale data.
  const isStaticAsset = ['style', 'script', 'font', 'image', 'manifest'].includes(request.destination);
  if (!isStaticAsset) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (!response.ok) return response;
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match(request).then(response => response || caches.match('./404.html'))));
});

