/* eslint-disable no-restricted-globals */

// Simpele, veilige PWA service worker:
// - cache alleen de app-shell/offline pagina
// - cache NOOIT /api/* responses (gevoelig + dynamisch)

const CACHE_NAME = "ai-coach-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Alleen same-origin
  if (url.origin !== self.location.origin) return;

  // Nooit API cachen
  if (url.pathname.startsWith("/api/")) return;

  // Navigaties: network-first, fallback offline pagina
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      })
    );
    return;
  }
});

