"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

export type ActiveDayStore = {
  get: () => string | null;
  set: (date: string | null) => void;
  subscribe: (listener: () => void) => () => void;
};

/**
 * A one-value store for "which day is currently active" (hovered/selected in
 * the heatmap). Kept out of React state so writing it does not re-render the
 * shared ancestor — only components that call useActiveDate() re-render.
 */
export function createActiveDayStore(): ActiveDayStore {
  let activeDate: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => activeDate,
    set: (date) => {
      if (date === activeDate) return;
      activeDate = date;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Inert default: a TrendChart rendered outside a provider (the dashboard) reads
// null forever, so its linked marker is a no-op there.
const ActiveDayContext = createContext<ActiveDayStore>(createActiveDayStore());

export const ActiveDayProvider = ActiveDayContext.Provider;

export function useActiveDayStore(): ActiveDayStore {
  return useContext(ActiveDayContext);
}

export function useActiveDate(): string | null {
  const store = useActiveDayStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
