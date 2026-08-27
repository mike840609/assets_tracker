import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface RequestStub {
  method: string;
  url: string;
  destination?: string;
  mode?: string;
}

interface ResponseStub {
  body: string;
  ok: boolean;
  status: number;
  type: string;
  redirected?: boolean;
  headers?: { get: (name: string) => string | null };
  clone: () => ResponseStub;
}

interface FetchEventStub {
  request: RequestStub;
  respondWith: (response: unknown) => void;
  waitUntil: (promise: Promise<unknown>) => void;
  preloadResponse: Promise<ResponseStub | undefined>;
}

interface CacheStub {
  match: (request: RequestStub | string) => Promise<ResponseStub | undefined>;
  put: (request: RequestStub | string, response: ResponseStub) => Promise<void>;
  keys: () => Promise<RequestStub[]>;
  delete: (request: RequestStub) => Promise<boolean>;
}

type FetchListener = (event: FetchEventStub) => void;
type LifecycleListener = (event: { waitUntil: (promise: Promise<unknown>) => void }) => void;

function makeResponse(
  body: string,
  onClone?: () => void,
  opts?: { status?: number; type?: string; ok?: boolean; redirected?: boolean; date?: string },
): ResponseStub {
  const status = opts?.status ?? 200;
  const type = opts?.type ?? "basic";
  const ok = opts?.ok ?? (status >= 200 && status < 300);
  const redirected = opts?.redirected ?? false;
  const date = opts?.date;
  return {
    body,
    ok,
    status,
    type,
    redirected,
    headers: { get: (name) => (name.toLowerCase() === "date" ? (date ?? null) : null) },
    clone: () => {
      onClone?.();
      return makeResponse(body, onClone, { status, type, ok, redirected, date });
    },
  };
}

function createCache(): CacheStub & {
  get: (request: RequestStub) => ResponseStub | undefined;
  failNextPut: (error?: Error) => void;
} {
  const entries = new Map<string, ResponseStub>();
  const keyFor = (request: RequestStub | string) =>
    typeof request === "string" ? request : request.url;
  let putError: Error | undefined;

  return {
    async match(request) {
      if (typeof request === "string") {
        if (entries.has(request)) return entries.get(request);
        // support "/offline" resolving to "https://astt.app/offline"
        for (const [k, v] of entries) {
          if (k.endsWith(request)) return v;
        }
        return undefined;
      }
      const direct = entries.get(keyFor(request));
      if (direct) return direct;
      // fallback: if request url ends with stored key (for "/offline" stored as full url)
      return undefined;
    },
    async put(request, response) {
      if (putError) {
        const error = putError;
        putError = undefined;
        throw error;
      }
      entries.set(keyFor(request), response);
    },
    async keys() {
      return [...entries.keys()].map((url) => ({ method: "GET", url }));
    },
    async delete(request) {
      return entries.delete(keyFor(request));
    },
    get(request) {
      return entries.get(keyFor(request));
    },
    failNextPut(error = new Error("cache put failed")) {
      putError = error;
    },
  };
}

function loadFetchListener() {
  let fetchListener: FetchListener | undefined;
  let activateListener: LifecycleListener | undefined;
  const cache = createCache();
  const cacheEvents: string[] = [];
  let cacheOpenCount = 0;
  const networkFetch = vi.fn<(request: RequestStub) => Promise<ResponseStub>>();
  const serviceWorker = {
    location: { origin: "https://astt.app" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    registration: { navigationPreload: { enable: vi.fn(async () => {}) } },
    addEventListener(type: string, listener: unknown) {
      if (type === "fetch") fetchListener = listener as FetchListener;
      if (type === "activate") activateListener = listener as LifecycleListener;
    },
  };
  const caches = {
    open: vi.fn(async () => {
      cacheEvents.push(`open-${++cacheOpenCount}`);
      return cache;
    }),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };

  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  runInNewContext(source, {
    self: serviceWorker,
    fetch: networkFetch,
    caches,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
  });

  if (!fetchListener) throw new Error("public/sw.js did not register a fetch listener");
  if (!activateListener) throw new Error("public/sw.js did not register an activate listener");
  return { fetchListener, activateListener, networkFetch, cache, cacheEvents };
}

async function dispatchActivate(activateListener: LifecycleListener) {
  const pending: Promise<unknown>[] = [];
  activateListener({ waitUntil: (promise) => pending.push(promise.catch(() => {})) });
  await Promise.all(pending);
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toUTCString();
}

function dispatchFetch(
  fetchListener: FetchListener,
  request: RequestStub,
  preload?: ResponseStub,
  opts?: { preloadError?: unknown },
) {
  let responsePromise: Promise<unknown> | undefined;
  const respondWith = vi.fn((response: unknown) => {
    responsePromise = Promise.resolve(response);
  });
  const pending: Promise<unknown>[] = [];
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(Promise.resolve(promise).catch(() => {}));
  });

  fetchListener({
    request,
    respondWith,
    waitUntil,
    preloadResponse: opts ? Promise.reject(opts.preloadError) : Promise.resolve(preload),
  } as FetchEventStub);

  return {
    respondWith,
    waitUntil,
    async waitUntilAll() {
      // waitUntil callbacks can register more work, so drain until stable.
      for (let i = 0; i < 5 && pending.length; i += 1) {
        await Promise.all([...pending]);
        await flushMicrotasks();
      }
    },
    async body() {
      const response = (await responsePromise) as ResponseStub;
      return response.body;
    },
    async response() {
      return (await responsePromise) as ResponseStub;
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("service worker fetch boundary", () => {
  it("returns a cached static asset immediately and refreshes it in the background", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const request = { method: "GET", url: "https://astt.app/_next/static/chunk.js" };
    await cache.put(request, makeResponse("cached"));
    networkFetch.mockResolvedValueOnce(makeResponse("fresh"));

    const event = dispatchFetch(fetchListener, request);

    expect(event.respondWith).toHaveBeenCalledOnce();
    expect(await event.body()).toBe("cached");
    expect(networkFetch).toHaveBeenCalledWith(request);

    await flushMicrotasks();

    expect(cache.get(request)?.body).toBe("fresh");
  });

  it("waits for the network when a cacheable static asset is missing", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const request = { method: "GET", url: "https://astt.app/icons/icon-192.png" };
    networkFetch.mockResolvedValueOnce(makeResponse("icon"));

    const event = dispatchFetch(fetchListener, request);

    expect(event.respondWith).toHaveBeenCalledOnce();
    expect(await event.body()).toBe("icon");
    expect(cache.get(request)?.body).toBe("icon");
  });

  it("clones a network response before opening the cache for its write", async () => {
    const { fetchListener, networkFetch, cacheEvents } = loadFetchListener();
    const request = { method: "GET", url: "https://astt.app/icon.svg" };
    networkFetch.mockResolvedValueOnce(makeResponse("fresh", () => cacheEvents.push("clone")));

    const event = dispatchFetch(fetchListener, request);

    await expect(event.body()).resolves.toBe("fresh");
    expect(cacheEvents.slice(0, 3)).toEqual(["open-1", "clone", "open-2"]);
  });

  it("serves a network response even when cache storage write fails on a miss", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const request = { method: "GET", url: "https://astt.app/icon.svg" };
    cache.failNextPut();
    networkFetch.mockResolvedValueOnce(makeResponse("fresh"));

    const event = dispatchFetch(fetchListener, request);

    expect(event.respondWith).toHaveBeenCalledOnce();
    await expect(event.body()).resolves.toBe("fresh");

    await flushMicrotasks();

    expect(cache.get(request)).toBeUndefined();
  });

  it("intercepts navigation requests for documents via navigation handler", async () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    networkFetch.mockResolvedValueOnce(makeResponse("<html>icon</html>"));
    const event = dispatchFetch(fetchListener, {
      method: "GET",
      url: "https://astt.app/icon",
      destination: "document",
      mode: "navigate",
    });

    expect(event.respondWith).toHaveBeenCalledOnce();
    await expect(event.body()).resolves.toBe("<html>icon</html>");
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it("does not intercept API requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const event = dispatchFetch(fetchListener, {
      method: "GET",
      url: "https://astt.app/api/accounts",
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it("does not intercept cross-origin GET requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const event = dispatchFetch(fetchListener, {
      method: "GET",
      url: "https://lh3.googleusercontent.com/avatar.png",
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it("does not intercept non-GET requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const event = dispatchFetch(fetchListener, {
      method: "POST",
      url: "https://astt.app/icons/icon-192.png",
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it("caches a successful navigation and serves it on offline fallback", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    networkFetch.mockResolvedValueOnce(makeResponse("<html>home</html>"));
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("<html>offline</html>"),
    );
    const ev1 = dispatchFetch(fetchListener, nav);
    await expect(ev1.body()).resolves.toBe("<html>home</html>");
    await flushMicrotasks();
    // second navigation offline should hit cache
    networkFetch.mockRejectedValueOnce(new Error("offline"));
    const ev2 = dispatchFetch(fetchListener, nav);
    await expect(ev2.body()).resolves.toBe("<html>home</html>");
  });

  it("does not cache 3xx navigation responses", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    networkFetch.mockResolvedValueOnce({
      body: "",
      ok: false,
      clone() {
        return this;
      },
      status: 302,
      type: "basic",
    } as unknown as ResponseStub);
    const ev = dispatchFetch(fetchListener, nav);
    await ev.body().catch(() => {});
    expect(cache.get(nav)).toBeUndefined();
  });

  it("falls back to offline page when navigation has no cache", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("offline"),
    );
    networkFetch.mockRejectedValueOnce(new Error("offline"));
    const ev = dispatchFetch(fetchListener, {
      method: "GET",
      url: "https://astt.app/unknown",
      mode: "navigate",
    } as RequestStub);
    await expect(ev.body()).resolves.toBe("offline");
  });

  it("uses navigationPreload response when available", async () => {
    const { fetchListener, cache } = loadFetchListener();
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("offline"),
    );
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    const preload = makeResponse("<html>preload</html>");
    const ev = dispatchFetch(fetchListener, nav, preload);
    await expect(ev.body()).resolves.toBe("<html>preload</html>");
    await flushMicrotasks();
    expect(cache.get(nav)?.body).toBe("<html>preload</html>");
  });

  it("does not cache opaque navigation responses", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    networkFetch.mockResolvedValueOnce({
      body: "opaque",
      ok: true,
      clone() {
        return this;
      },
      status: 200,
      type: "opaque",
    } as unknown as ResponseStub);
    const ev = dispatchFetch(fetchListener, nav);
    await ev.body().catch(() => {});
    await flushMicrotasks();
    expect(cache.get(nav)).toBeUndefined();
  });

  it("does not cache failed navigation responses", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    networkFetch.mockResolvedValueOnce({
      body: "error",
      ok: false,
      clone() {
        return this;
      },
      status: 500,
      type: "basic",
    } as unknown as ResponseStub);
    const ev = dispatchFetch(fetchListener, nav);
    await ev.body().catch(() => {});
    await flushMicrotasks();
    expect(cache.get(nav)).toBeUndefined();
  });
  it("falls back to the offline page when the navigation preload request fails", async () => {
    // Regression: `event.preloadResponse` rejects on network error. Awaiting it
    // outside the try/catch rejected respondWith and killed the offline fallback
    // on exactly the browsers that support navigation preload.
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("offline"),
    );
    networkFetch.mockRejectedValueOnce(new Error("offline"));

    const ev = dispatchFetch(
      fetchListener,
      { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub,
      undefined,
      { preloadError: new Error("preload failed with a network error") },
    );

    await expect(ev.body()).resolves.toBe("offline");
  });

  it("retries over the network when only the navigation preload failed", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("offline"),
    );
    networkFetch.mockResolvedValueOnce(makeResponse("<html>home</html>"));

    const ev = dispatchFetch(
      fetchListener,
      { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub,
      undefined,
      { preloadError: new Error("preload failed with a network error") },
    );

    await expect(ev.body()).resolves.toBe("<html>home</html>");
  });

  it("serves the cached page past the timeout and still warms the cache from the slow request", async () => {
    vi.useFakeTimers();
    try {
      const { fetchListener, networkFetch, cache } = loadFetchListener();
      const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
      await cache.put(nav, makeResponse("<html>stale</html>"));
      let settleNetwork: (response: ResponseStub) => void = () => {};
      networkFetch.mockReturnValueOnce(
        new Promise<ResponseStub>((resolve) => {
          settleNetwork = resolve;
        }),
      );

      const ev = dispatchFetch(fetchListener, nav);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(ev.body()).resolves.toBe("<html>stale</html>");

      settleNetwork(makeResponse("<html>fresh</html>"));
      await ev.waitUntilAll();
      expect(cache.get(nav)?.body).toBe("<html>fresh</html>");
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for a slow network rather than claiming offline when nothing is cached", async () => {
    vi.useFakeTimers();
    try {
      const { fetchListener, networkFetch, cache } = loadFetchListener();
      await cache.put(
        { method: "GET", url: "https://astt.app/offline" } as RequestStub,
        makeResponse("offline"),
      );
      let settleNetwork: (response: ResponseStub) => void = () => {};
      networkFetch.mockReturnValueOnce(
        new Promise<ResponseStub>((resolve) => {
          settleNetwork = resolve;
        }),
      );

      const ev = dispatchFetch(fetchListener, {
        method: "GET",
        url: "https://astt.app/",
        mode: "navigate",
      } as RequestStub);
      await vi.advanceTimersByTimeAsync(6000);
      settleNetwork(makeResponse("<html>slow but online</html>"));

      await expect(ev.body()).resolves.toBe("<html>slow but online</html>");
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers the offline page over a navigation cache entry older than a day", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    await cache.put(
      nav,
      makeResponse("<html>ancient</html>", undefined, {
        date: new Date(Date.now() - 48 * 60 * 60 * 1000).toUTCString(),
      }),
    );
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("offline"),
    );
    networkFetch.mockRejectedValueOnce(new Error("offline"));

    const ev = dispatchFetch(fetchListener, nav);

    await expect(ev.body()).resolves.toBe("offline");
  });

  it("drops cached authenticated pages when a /login navigation happens", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const home = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    const login = { method: "GET", url: "https://astt.app/login", mode: "navigate" } as RequestStub;
    await cache.put(home, makeResponse("<html>dashboard</html>"));
    await cache.put(
      { method: "GET", url: "https://astt.app/offline" } as RequestStub,
      makeResponse("offline"),
    );
    networkFetch.mockResolvedValueOnce(makeResponse("<html>login</html>"));

    const ev = dispatchFetch(fetchListener, login);
    await expect(ev.body()).resolves.toBe("<html>login</html>");
    await ev.waitUntilAll();

    expect(cache.get(home)).toBeUndefined();
    expect(cache.get(login)).toBeUndefined();
    await expect(cache.match("/offline")).resolves.toBeDefined();
  });

  it("does not intercept top-level navigations to API routes", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const ev = dispatchFetch(fetchListener, {
      method: "GET",
      url: "https://astt.app/api/export/portfolio.csv",
      mode: "navigate",
    } as RequestStub);

    expect(networkFetch).not.toHaveBeenCalled();
    expect(ev.respondWith).not.toHaveBeenCalled();
  });

  it("does not cache a navigation response that followed a redirect", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    networkFetch.mockResolvedValueOnce(
      makeResponse("<html>login</html>", undefined, { redirected: true }),
    );

    const ev = dispatchFetch(fetchListener, nav);
    await expect(ev.body()).resolves.toBe("<html>login</html>");
    await ev.waitUntilAll();

    expect(cache.get(nav)).toBeUndefined();
  });
  it("evicts navigation cache entries older than a day on activate", async () => {
    const { activateListener, cache } = loadFetchListener();
    const fresh = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    const stale = {
      method: "GET",
      url: "https://astt.app/history",
      mode: "navigate",
    } as RequestStub;
    const offline = { method: "GET", url: "https://astt.app/offline" } as RequestStub;
    await cache.put(fresh, makeResponse("<html>fresh</html>", undefined, { date: hoursAgo(1) }));
    await cache.put(stale, makeResponse("<html>stale</html>", undefined, { date: hoursAgo(48) }));
    await cache.put(offline, makeResponse("offline", undefined, { date: hoursAgo(48) }));

    await dispatchActivate(activateListener);

    expect(cache.get(fresh)).toBeDefined();
    expect(cache.get(stale)).toBeUndefined();
    // The last-resort fallback is exempt: it is only refreshed on install/activate.
    expect(cache.get(offline)).toBeDefined();
  });
});
