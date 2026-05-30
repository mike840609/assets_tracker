"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Hydration-safe viewport media-query hook.
 *
 * Uses `useSyncExternalStore` so the server snapshot (`false`) is also used for
 * the initial client render. That keeps the hydrated markup identical to the
 * server HTML — avoiding mismatches in consumers that branch on it (e.g. Dialog
 * vs. Drawer) — then React re-renders with the real client value immediately
 * after hydration without a warning. Components mounted after hydration read the
 * correct value on first render, so there's no flash either.
 */
export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
