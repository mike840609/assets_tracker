"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribeToViewportReady() {
  return () => {};
}

function getViewportReadySnapshot() {
  return true;
}

function getServerViewportReadySnapshot() {
  return false;
}

/**
 * Returns false for the server render and the initial hydrated render, then true
 * once a client viewport is available for responsive mount decisions.
 */
export function useIsViewportReady() {
  return useSyncExternalStore(
    subscribeToViewportReady,
    getViewportReadySnapshot,
    getServerViewportReadySnapshot,
  );
}

type ViewportListener = () => void;

type ViewportStore = {
  mediaQuery: MediaQueryList;
  listeners: Set<ViewportListener>;
  handleChange: () => void;
};

const viewportStores = new Map<string, ViewportStore>();

function getViewportStore(query: string) {
  const existing = viewportStores.get(query);
  if (existing) return existing;

  const listeners = new Set<ViewportListener>();
  const mediaQuery = window.matchMedia(query);
  const store: ViewportStore = {
    mediaQuery,
    listeners,
    handleChange: () => {
      for (const listener of listeners) listener();
    },
  };
  viewportStores.set(query, store);
  return store;
}

export function subscribeToViewport(query: string, callback: ViewportListener) {
  if (typeof window === "undefined") return () => {};

  const store = getViewportStore(query);
  store.listeners.add(callback);
  if (store.listeners.size === 1) {
    store.mediaQuery.addEventListener("change", store.handleChange);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    store.listeners.delete(callback);
    if (store.listeners.size === 0) {
      store.mediaQuery.removeEventListener("change", store.handleChange);
      viewportStores.delete(query);
    }
  };
}

export function getViewportSnapshot(query: string) {
  if (typeof window === "undefined") return false;
  return getViewportStore(query).mediaQuery.matches;
}

export function getViewportServerSnapshot() {
  return false;
}

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
    (onChange: () => void) => subscribeToViewport(query, onChange),
    [query],
  );
  const getSnapshot = useCallback(() => getViewportSnapshot(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getViewportServerSnapshot);
}
