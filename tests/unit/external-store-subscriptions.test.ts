import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPrivacyModeServerSnapshot,
  getPrivacyModeSnapshot,
  subscribeToPrivacyMode,
} from "@/components/layout/privacy-mode-context";
import {
  getViewportServerSnapshot,
  getViewportSnapshot,
  subscribeToViewport,
} from "@/hooks/use-is-mobile";

type FakeMediaQueryList = {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  emitChange: () => void;
};

function createMediaQueryList(matches = false): FakeMediaQueryList {
  const target = new EventTarget();
  return {
    matches,
    addEventListener: vi.fn(target.addEventListener.bind(target)),
    removeEventListener: vi.fn(target.removeEventListener.bind(target)),
    emitChange: () => target.dispatchEvent(new Event("change")),
  };
}

function createWindowStub() {
  const target = new EventTarget();
  const values = new Map<string, string>();
  const mediaQueries = new Map<string, FakeMediaQueryList>();
  const addEventListener = vi.fn(target.addEventListener.bind(target));
  const removeEventListener = vi.fn(target.removeEventListener.bind(target));
  const matchMedia = vi.fn((query: string) => {
    let mediaQuery = mediaQueries.get(query);
    if (!mediaQuery) {
      mediaQuery = createMediaQueryList();
      mediaQueries.set(query, mediaQuery);
    }
    return mediaQuery;
  });

  return {
    window: {
      addEventListener,
      removeEventListener,
      dispatchEvent: target.dispatchEvent.bind(target),
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      matchMedia,
    },
    addEventListener,
    removeEventListener,
    matchMedia,
    mediaQueries,
    values,
  };
}

function storageEvent(key: string): Event {
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: key });
  return event;
}

let harness: ReturnType<typeof createWindowStub>;

beforeEach(() => {
  harness = createWindowStub();
  vi.stubGlobal("window", harness.window);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("privacy mode external store", () => {
  it("uses one browser listener pair and fans storage/custom events out to every subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeToPrivacyMode(first);
    const stopSecond = subscribeToPrivacyMode(second);

    expect(harness.addEventListener.mock.calls.map(([type]) => type)).toEqual([
      "storage",
      "privacy-mode-change",
    ]);

    harness.window.dispatchEvent(storageEvent("unrelated-key"));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    harness.window.dispatchEvent(storageEvent("asset-tracker:v1:privacy-mode"));
    harness.window.dispatchEvent(new Event("privacy-mode-change"));
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);

    stopFirst();
    expect(harness.removeEventListener).not.toHaveBeenCalled();

    stopSecond();
    expect(harness.removeEventListener.mock.calls.map(([type]) => type)).toEqual([
      "storage",
      "privacy-mode-change",
    ]);

    harness.window.dispatchEvent(new Event("privacy-mode-change"));
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("returns server-safe snapshots and does not touch browser APIs without window", () => {
    vi.unstubAllGlobals();

    expect(getPrivacyModeSnapshot()).toBe(false);
    expect(getPrivacyModeServerSnapshot()).toBe(false);

    const stop = subscribeToPrivacyMode(vi.fn());
    stop();
  });

  it("migrates recognized legacy state and defaults invalid current state", () => {
    harness.values.set("privacy-mode", "true");

    expect(getPrivacyModeSnapshot()).toBe(true);
    expect(harness.values.get("asset-tracker:v1:privacy-mode")).toBe("true");
    expect(harness.values.has("privacy-mode")).toBe(false);

    harness.values.set("asset-tracker:v1:privacy-mode", "invalid");
    expect(getPrivacyModeSnapshot()).toBe(false);
  });
});

describe("viewport external store", () => {
  it("shares one MediaQueryList listener per query and keeps different queries independent", () => {
    const phoneQuery = "(max-width: 767px)";
    const smallPhoneQuery = "(max-width: 639px)";
    const first = vi.fn();
    const second = vi.fn();
    const third = vi.fn();

    const stopFirst = subscribeToViewport(phoneQuery, first);
    const stopSecond = subscribeToViewport(phoneQuery, second);
    const stopThird = subscribeToViewport(smallPhoneQuery, third);
    const phone = harness.mediaQueries.get(phoneQuery)!;
    const smallPhone = harness.mediaQueries.get(smallPhoneQuery)!;

    expect(harness.matchMedia).toHaveBeenCalledTimes(2);
    expect(phone.addEventListener).toHaveBeenCalledTimes(1);
    expect(smallPhone.addEventListener).toHaveBeenCalledTimes(1);

    phone.emitChange();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();

    smallPhone.emitChange();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);

    stopFirst();
    expect(phone.removeEventListener).not.toHaveBeenCalled();

    stopSecond();
    expect(phone.removeEventListener).toHaveBeenCalledTimes(1);

    stopThird();
    expect(smallPhone.removeEventListener).toHaveBeenCalledTimes(1);

    phone.emitChange();
    smallPhone.emitChange();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
  });

  it("reads the cached query state and stays browser-safe on the server", () => {
    const query = "(max-width: 767px)";

    expect(getViewportSnapshot(query)).toBe(false);
    expect(harness.matchMedia).toHaveBeenCalledTimes(1);

    const cached = harness.mediaQueries.get(query)!;
    cached.matches = true;
    expect(getViewportSnapshot(query)).toBe(true);
    expect(harness.matchMedia).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    expect(getViewportSnapshot(query)).toBe(false);
    expect(getViewportServerSnapshot()).toBe(false);
    const stop = subscribeToViewport(query, vi.fn());
    stop();
  });
});
