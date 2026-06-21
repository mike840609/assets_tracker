import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface FetchEventStub {
  request: { method: string; url: string };
  respondWith: (response: unknown) => void;
}

type FetchListener = (event: FetchEventStub) => void;

function loadFetchListener() {
  let fetchListener: FetchListener | undefined;
  const networkResponse = Promise.resolve({ ok: true });
  const networkFetch = vi.fn(() => networkResponse);
  const serviceWorker = {
    location: { origin: "https://astt.app" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener(type: string, listener: unknown) {
      if (type === "fetch") fetchListener = listener as FetchListener;
    },
  };

  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  runInNewContext(source, { self: serviceWorker, fetch: networkFetch, URL });

  if (!fetchListener) throw new Error("public/sw.js did not register a fetch listener");
  return { fetchListener, networkFetch, networkResponse };
}

describe("service worker fetch boundary", () => {
  it("passes same-origin GET requests through the network", () => {
    const { fetchListener, networkFetch, networkResponse } = loadFetchListener();
    const respondWith = vi.fn();
    const request = { method: "GET", url: "https://astt.app/dashboard" };

    fetchListener({ request, respondWith });

    expect(networkFetch).toHaveBeenCalledWith(request);
    expect(respondWith).toHaveBeenCalledWith(networkResponse);
  });

  it("does not intercept cross-origin GET requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const respondWith = vi.fn();

    fetchListener({
      request: { method: "GET", url: "https://lh3.googleusercontent.com/avatar.png" },
      respondWith,
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(respondWith).not.toHaveBeenCalled();
  });

  it("does not intercept non-GET requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const respondWith = vi.fn();

    fetchListener({
      request: { method: "POST", url: "https://astt.app/api/accounts" },
      respondWith,
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(respondWith).not.toHaveBeenCalled();
  });
});
