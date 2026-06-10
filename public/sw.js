// Minimal network-only service worker.
// Satisfies Chrome's PWA installability requirement (needs a fetch listener)
// without adding any caching — all requests pass through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method === "GET") {
    e.respondWith(fetch(e.request));
  }
});
