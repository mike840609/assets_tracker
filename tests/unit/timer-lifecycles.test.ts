import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getFreshnessClockSnapshot,
  refreshFreshnessClock,
  startCooldownTicker,
  subscribeToFreshnessClock,
} from "@/lib/timer-lifecycles";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startCooldownTicker", () => {
  it("ticks once per second and stops when the cooldown expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T00:00:00Z"));
    vi.stubGlobal("window", globalThis);
    const onTick = vi.fn();
    const stop = startCooldownTicker(Date.now() + 2_000, onTick);

    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(onTick).toHaveBeenLastCalledWith(Date.parse("2026-08-23T00:00:01Z"));
    vi.advanceTimersByTime(1_000);
    expect(onTick).toHaveBeenLastCalledWith(Date.parse("2026-08-23T00:00:02Z"));
    expect(vi.getTimerCount()).toBe(0);

    stop();
  });
});

describe("freshness clock", () => {
  it("shares one clock and updates all subscribers promptly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T00:00:00Z"));
    vi.stubGlobal("window", globalThis);
    const first = vi.fn();
    const second = vi.fn();

    const stopFirst = subscribeToFreshnessClock(first);
    const stopSecond = subscribeToFreshnessClock(second);
    expect(vi.getTimerCount()).toBe(2);

    vi.advanceTimersByTime(0);
    expect(getFreshnessClockSnapshot()).toBe(Date.parse("2026-08-23T00:00:00Z"));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);

    refreshFreshnessClock();
    expect(first).toHaveBeenCalledTimes(3);
    expect(second).toHaveBeenCalledTimes(3);

    stopFirst();
    stopSecond();
    expect(vi.getTimerCount()).toBe(0);
  });
});
