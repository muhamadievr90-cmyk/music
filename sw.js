// Service Worker: Музыка всегда с собой
const CACHE = "music-v2";
const STATIC = ["/", "/index.html", "/manifest.json"];
const API_CACHE = "music-api-v1";
const AUDIO_CACHE = "music-audio-v1";

// Install: cache static assets
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => ![CACHE, API_CACHE, AUDIO_CACHE].includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static, cache audio
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API requests: network-first, cache fallback
  if (url.hostname === "api.jamendo.com") {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(API_CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Audio files: cache on play
  if (url.pathname.endsWith(".mp3") || url.hostname.includes("jamendo") && url.pathname.includes("/track/")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(AUDIO_CACHE).then(c => c.put(e.request, clone));
          }
          return r;
        });
      })
    );
    return;
  }

  // Static: cache-first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok && (url.origin === self.location.origin)) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => {
        // Offline fallback page
        if (e.request.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
