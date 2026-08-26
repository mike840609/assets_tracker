const STATIC_CACHE = "astt-static-v1";
const STATIC_CACHE_PREFIX = "astt-static-";
const NAV_CACHE = "astt-nav-v1";
const NAV_CACHE_PREFIX = "astt-nav-";
const OFFLINE_URL = "/offline";
const NAV_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      try {
        const cache = await caches.open(NAV_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {}
    })(),
  ),
);

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (n) =>
              (n.startsWith(STATIC_CACHE_PREFIX) || n.startsWith(NAV_CACHE_PREFIX)) &&
              n !== STATIC_CACHE &&
              n !== NAV_CACHE,
          )
          .map((n) => caches.delete(n)),
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
      await self.clients.claim();
    })(),
  ),
);

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon"
  );
}

function isNavigationRequest(request) {
  return (
    request.method === "GET" &&
    request.mode === "navigate" &&
    new URL(request.url).origin === self.location.origin
  );
}

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  if (request.destination === "document" || request.mode === "navigate") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && isStaticAsset(url.pathname);
}

async function refreshStaticAsset(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cacheResponse = response.clone();
    caches
      .open(STATIC_CACHE)
      .then((c) => c.put(request, cacheResponse))
      .catch(() => {});
  }
  return response;
}

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function handleNavigation(event) {
  const preload = await event.preloadResponse;
  if (preload) {
    if (preload.ok && preload.type === "basic") {
      const cache = await caches.open(NAV_CACHE);
      cache.put(event.request, preload.clone()).catch(() => {});
    }
    return preload;
  }
  const cache = await caches.open(NAV_CACHE);
  try {
    const response = await fetchWithTimeout(event.request, NAV_TIMEOUT_MS);
    if (response && response.ok && response.type === "basic" && response.status === 200) {
      cache.put(event.request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw new Error("offline and no cache");
  }
}

self.addEventListener("fetch", (event) => {
  if (isCacheableRequest(event.request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(event.request);
        if (cached) {
          refreshStaticAsset(event.request).catch(() => {});
          return cached;
        }
        return refreshStaticAsset(event.request);
      })(),
    );
    return;
  }
  if (isNavigationRequest(event.request)) {
    event.respondWith(handleNavigation(event));
  }
});
