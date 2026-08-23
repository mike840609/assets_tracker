import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPrivacyModeServerSnapshot,
  getPrivacyModeSnapshot,
  subscribeToPrivacyMode,
} from "@/components/layout/privacy-mode-context";

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
      },
      matchMedia,
    },
    addEventListener,
    removeEventListener,
    matchMedia,
    mediaQueries,
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

    harness.window.dispatchEvent(storageEvent("privacy-mode"));
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
});
