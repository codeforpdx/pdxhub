const CACHE_NAME = "pdx-hub-v2";
const STATIC_ASSETS = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first for API routes, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isNextAsset = url.pathname.startsWith("/_next/");

  if (
    isNavigation ||
    isNextAsset ||
    url.pathname.startsWith("/api/") ||
    url.hostname !== self.location.hostname
  ) {
    // Network only for document navigations, Next assets, API calls, and external resources.
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (
          !response ||
          response.status !== 200 ||
          event.request.method !== "GET"
        ) {
          return response;
        }

        const responseClone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseClone));
        return response;
      });
    }),
  );
});
