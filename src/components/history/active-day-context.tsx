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
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// A provider-less consumer (e.g. the dashboard, which renders the heatmap
// and trend chart without an ActiveDayProvider) must be a complete no-op:
// set does nothing, get is always null, so no marker ever appears there.
const INERT_STORE: ActiveDayStore = {
  get: () => null,
  set: () => {},
  subscribe: () => () => {},
};

const ActiveDayContext = createContext<ActiveDayStore>(INERT_STORE);

export const ActiveDayProvider = ActiveDayContext.Provider;

export function useActiveDayStore(): ActiveDayStore {
  return useContext(ActiveDayContext);
}

export function useActiveDate(): string | null {
  const store = useActiveDayStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
