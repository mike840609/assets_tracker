import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  listeners: new Map<string, EventListener>(),
  push: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useRef: (value: unknown) => ({ current: value }),
    useState: (initial: unknown) => [
      typeof initial === "function" ? (initial as () => unknown)() : initial,
      vi.fn(),
    ],
    useTransition: () => [false, (callback: () => void) => callback()],
  };
});

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push }),
}));

vi.mock("@/components/layout/privacy-mode-context", () => ({
  usePrivacyMode: () => ({ togglePrivacyMode: vi.fn() }),
}));

import { LazyCommandPalette } from "@/components/layout/lazy-command-palette";

type Modifier = "metaKey" | "ctrlKey";

function createKeyEvent(key: string, modifier?: Modifier) {
  return {
    key,
    code: "",
    target: null,
    metaKey: modifier === "metaKey",
    ctrlKey: modifier === "ctrlKey",
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

function press(event: KeyboardEvent) {
  const listener = harness.listeners.get("keydown");
  if (!listener) throw new Error("keydown listener was not registered");
  listener(event);
}

beforeEach(() => {
  harness.listeners.clear();
  harness.push.mockClear();

  vi.stubGlobal("window", {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      harness.listeners.set(type, listener);
    }),
    removeEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: true })),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    dispatchEvent: vi.fn(),
  });

  LazyCommandPalette();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktop navigation shortcuts", () => {
  it("navigates plain 7 to Calendar", () => {
    press(createKeyEvent("7"));

    expect(harness.push).toHaveBeenCalledWith("/calendar");
  });

  it("navigates plain g c to Calendar", () => {
    press(createKeyEvent("g"));
    press(createKeyEvent("c"));

    expect(harness.push).toHaveBeenCalledWith("/calendar");
  });

  it.each(["metaKey", "ctrlKey"] as const)("preserves native %s+9 behavior", (modifier) => {
    const event = createKeyEvent("9", modifier);

    press(event);

    expect(harness.push).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each(["metaKey", "ctrlKey"] as const)(
    "clears g sequence and preserves native %s+c behavior",
    (modifier) => {
      press(createKeyEvent("g"));
      const copyEvent = createKeyEvent("c", modifier);
      press(copyEvent);
      press(createKeyEvent("c"));

      expect(harness.push).not.toHaveBeenCalled();
      expect(copyEvent.preventDefault).not.toHaveBeenCalled();
    },
  );
});
