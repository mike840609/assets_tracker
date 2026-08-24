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
  clone: () => ResponseStub;
}

interface FetchEventStub {
  request: RequestStub;
  respondWith: (response: unknown) => void;
}

interface CacheStub {
  match: (request: RequestStub) => Promise<ResponseStub | undefined>;
  put: (request: RequestStub, response: ResponseStub) => Promise<void>;
}

type FetchListener = (event: FetchEventStub) => void;

function makeResponse(body: string, onClone?: () => void): ResponseStub {
  return {
    body,
    ok: true,
    clone: () => {
      onClone?.();
      return makeResponse(body, onClone);
    },
  };
}

function createCache(): CacheStub & {
  get: (request: RequestStub) => ResponseStub | undefined;
  failNextPut: (error?: Error) => void;
} {
  const entries = new Map<string, ResponseStub>();
  const keyFor = (request: RequestStub) => request.url;
  let putError: Error | undefined;

  return {
    async match(request) {
      return entries.get(keyFor(request));
    },
    async put(request, response) {
      if (putError) {
        const error = putError;
        putError = undefined;
        throw error;
      }
      entries.set(keyFor(request), response);
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
  const cache = createCache();
  const cacheEvents: string[] = [];
  let cacheOpenCount = 0;
  const networkFetch = vi.fn<(request: RequestStub) => Promise<ResponseStub>>();
  const serviceWorker = {
    location: { origin: "https://astt.app" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener(type: string, listener: unknown) {
      if (type === "fetch") fetchListener = listener as FetchListener;
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
  runInNewContext(source, { self: serviceWorker, fetch: networkFetch, caches, URL });

  if (!fetchListener) throw new Error("public/sw.js did not register a fetch listener");
  return { fetchListener, networkFetch, cache, cacheEvents };
}

function dispatchFetch(fetchListener: FetchListener, request: RequestStub) {
  let responsePromise: Promise<unknown> | undefined;
  const respondWith = vi.fn((response: unknown) => {
    responsePromise = Promise.resolve(response);
  });

  fetchListener({ request, respondWith });

  return {
    respondWith,
    async body() {
      const response = (await responsePromise) as ResponseStub;
      return response.body;
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

  it("does not intercept document requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const event = dispatchFetch(fetchListener, {
      method: "GET",
      url: "https://astt.app/icon",
      destination: "document",
      mode: "navigate",
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(event.respondWith).not.toHaveBeenCalled();
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
});
