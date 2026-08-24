"use client";

type ClockListener = () => void;

let freshnessNow: number | null = null;
let freshnessInterval: number | null = null;
let freshnessInitialTimer: number | null = null;
const freshnessListeners = new Set<ClockListener>();

function notifyFreshnessListeners() {
  freshnessNow = Date.now();
  for (const listener of freshnessListeners) listener();
}

export function subscribeToFreshnessClock(listener: ClockListener) {
  if (typeof window === "undefined") return () => {};

  freshnessListeners.add(listener);
  if (freshnessListeners.size === 1) {
    freshnessInitialTimer = window.setTimeout(() => {
      freshnessInitialTimer = null;
      notifyFreshnessListeners();
    }, 0);
    freshnessInterval = window.setInterval(notifyFreshnessListeners, 30_000);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    freshnessListeners.delete(listener);
    if (freshnessListeners.size === 0) {
      if (freshnessInitialTimer !== null) window.clearTimeout(freshnessInitialTimer);
      if (freshnessInterval !== null) window.clearInterval(freshnessInterval);
      freshnessInitialTimer = null;
      freshnessInterval = null;
      freshnessNow = null;
    }
  };
}

export function getFreshnessClockSnapshot() {
  return freshnessNow;
}

export function getFreshnessClockServerSnapshot() {
  return null;
}

export function refreshFreshnessClock() {
  if (freshnessListeners.size > 0) notifyFreshnessListeners();
}

export function startCooldownTicker(cooldownUntil: number, onTick: (now: number) => void) {
  if (typeof window === "undefined" || cooldownUntil <= Date.now()) return () => {};

  let active = true;
  const interval = window.setInterval(() => {
    const now = Date.now();
    onTick(now);
    if (now >= cooldownUntil) {
      active = false;
      window.clearInterval(interval);
    }
  }, 1_000);

  return () => {
    if (!active) return;
    active = false;
    window.clearInterval(interval);
  };
}
