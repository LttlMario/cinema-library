const CACHE = 'cinema-library-shell-v39-cache-first-20261027';
const SHELL_ASSET_TIMEOUT = 8000;
const SHELL = [
  './', './index.html', './catalog.html', './genres.html', './stream/index.html',
  './404.html', './contribute.html', './manifest.webmanifest',
  './assets/site-shell.css', './assets/site-shell.js', './assets/home-nav-fix.js', './assets/nav-parity.css', './assets/icons/cinema-library-favicon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(asset => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SHELL_ASSET_TIMEOUT);
    return fetch(asset, { cache: 'no-cache', signal: controller.signal })
      .then(response => response.ok ? cache.put(asset, response) : null)
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }))));
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
      // The cached shell is returned immediately, but the background refresh
      // must bypass the browser HTTP cache or a TV WebView can keep replaying
      // the previous deployed document indefinitely.
      const refresh = fetch(request, { cache: 'no-store' }).then(response => {
        if (response.ok) {
          const cacheKey = new Request(`${url.origin}${url.pathname}`);
          caches.open(CACHE).then(cache => cache.put(cacheKey, response.clone())).catch(() => {});
        }
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
  event.respondWith(caches.match(request).then(cached => {
    const refresh = fetch(request, { cache: 'no-store' }).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => cached || caches.match('./404.html'));
    // Keep the background refresh alive even when the cached response was
    // returned immediately by a slower TV WebView.
    event.waitUntil(refresh.then(() => undefined, () => undefined));
    // Reuse a known-good static asset immediately on TV, while refreshing it
    // in the background for the next navigation.
    return cached || refresh;
  }));
});

