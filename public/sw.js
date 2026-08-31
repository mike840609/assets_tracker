const STATIC_CACHE = "astt-static-v1";
const STATIC_CACHE_PREFIX = "astt-static-";
const NAV_CACHE = "astt-nav-v1";
const NAV_CACHE_PREFIX = "astt-nav-";
const OFFLINE_URL = "/offline";
const NAV_TIMEOUT_MS = 3000;
// ponytail: age bound stands in for build-id cache busting. Cached HTML points at
// build-specific /_next chunks, so a very old copy is worse than the offline page.
// Swap for the real build id in the cache name if deploys get more frequent.
const NAV_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let navCacheGeneration = 0;
let navCacheOperations = Promise.resolve();

function enqueueNavCacheOperation(operation) {
  const next = navCacheOperations.then(operation, operation);
  navCacheOperations = next.catch(() => {});
  return next;
}

// Bypasses the HTTP cache and refuses redirects, so a middleware bounce
// (expired demo, login) can never be stored under the /offline key.
async function precacheOfflinePage() {
  try {
    const response = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
    if (!response.ok || response.redirected || response.status !== 200) return;
    const cache = await caches.open(NAV_CACHE);
    await cache.put(OFFLINE_URL, response);
  } catch {}
}

self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      await precacheOfflinePage();
    })(),
  ),
);

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              (name.startsWith(STATIC_CACHE_PREFIX) || name.startsWith(NAV_CACHE_PREFIX)) &&
              name !== STATIC_CACHE &&
              name !== NAV_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await evictStaleNavEntries();
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
      // Retry: a transient failure during install would otherwise leave this
      // service worker version with no offline fallback for its whole lifetime.
      await precacheOfflinePage();
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("message", (event) => {
  if (event.data === "astt:purge-nav-cache") {
    event.waitUntil(caches.open(NAV_CACHE).then(purgeNavCache));
  }
});

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
  if (request.method !== "GET" || request.mode !== "navigate") return false;
  const url = new URL(request.url);
  // /api/* can be reached by a top-level navigation (exports, opened in a new
  // tab); those are not app shells and must never enter the navigation cache.
  return url.origin === self.location.origin && !url.pathname.startsWith("/api/");
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

// Everything but the offline page: that entry is the last-resort fallback and
// is re-fetched only on install/activate.
function purgeNavCache(cache) {
  navCacheGeneration += 1;
  return enqueueNavCacheOperation(async () => {
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => new URL(request.url).pathname !== OFFLINE_URL)
        .map((request) => cache.delete(request)),
    );
  });
}

// Entries past NAV_MAX_AGE_MS can never be served again, so collect them here
// instead of leaving them to occupy the origin's storage quota. Activate is the
// natural place: it already runs the cache GC and fires once per worker version.
async function evictStaleNavEntries() {
  const cache = await caches.open(NAV_CACHE);
  const requests = await cache.keys();
  await Promise.all(
    requests.map(async (request) => {
      if (new URL(request.url).pathname === OFFLINE_URL) return;
      const cached = await cache.match(request);
      if (cached && !isFresh(cached)) await cache.delete(request);
    }),
  );
}

function isCacheableNavResponse(response) {
  return Boolean(
    response &&
    response.ok &&
    response.status === 200 &&
    response.type === "basic" &&
    !response.redirected,
  );
}

function isFresh(response) {
  const date = response.headers?.get?.("date");
  if (!date) return true;
  const time = Date.parse(date);
  return !Number.isFinite(time) || Date.now() - time < NAV_MAX_AGE_MS;
}

function cacheNavigation(event, cache, response, generation) {
  if (!isCacheableNavResponse(response)) return;
  // waitUntil, not fire-and-forget: the browser is free to kill the worker as
  // soon as respondWith settles, which on mobile drops the write.
  const request = event.request;
  const cacheResponse = response.clone();
  event.waitUntil(
    enqueueNavCacheOperation(async () => {
      if (generation !== navCacheGeneration) return;
      await cache.put(request, cacheResponse);
    }).catch(() => {}),
  );
}

// Serves `cached` if the network has not answered within NAV_TIMEOUT_MS, but
// lets the slow request run to completion so the cache still warms — otherwise
// a permanently slow connection is pinned to stale data forever.
function raceWithTimeout(event, network, cached) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      event.waitUntil(network.catch(() => {}));
      resolve(cached);
    }, NAV_TIMEOUT_MS);
    network.then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      () => {
        clearTimeout(timer);
        resolve(cached);
      },
    );
  });
}

async function handleNavigation(event) {
  const generation = navCacheGeneration;
  const cache = await caches.open(NAV_CACHE);
  // Landing on /login means there is no session anymore, so the rendered
  // balances still sitting in the cache must not outlive it.
  const isLogin = new URL(event.request.url).pathname === "/login";
  if (isLogin) event.waitUntil(purgeNavCache(cache));

  try {
    // The preload promise rejects on network error; without the catch it would
    // escape this try and take the whole offline fallback with it.
    const network = event.preloadResponse
      .catch(() => undefined)
      .then((preload) => {
        if (preload) {
          if (!isLogin) cacheNavigation(event, cache, preload, generation);
          return preload;
        }
        return fetch(event.request).then((response) => {
          if (!isLogin) cacheNavigation(event, cache, response, generation);
          return response;
        });
      });
    const cached = isLogin ? undefined : await cache.match(event.request);
    const offline = await cache.match(OFFLINE_URL);
    const fallback = cached && isFresh(cached) ? cached : offline;
    // A slow uncached navigation still needs the same timeout as a cached one;
    // the precached offline page is the fallback when the route has no entry.
    if (!fallback) return await network;
    return await raceWithTimeout(event, network, fallback);
  } catch {
    const cached = isLogin ? undefined : await cache.match(event.request);
    if (cached && isFresh(cached)) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    if (cached) return cached;
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
