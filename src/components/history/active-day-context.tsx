"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

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

/**
 * Wraps a subtree that pairs a HistoryHeatmap (emitter) with a TrendChart
 * (LinkedMarker consumer) so the two are linked. Each boundary owns its own
 * store, so the History page and the dashboard stay independent. Server
 * components can render this and pass their content as children.
 */
export function ActiveDayBoundary({ children }: { children: ReactNode }) {
  const store = useMemo(() => createActiveDayStore(), []);
  return <ActiveDayProvider value={store}>{children}</ActiveDayProvider>;
}

export function useActiveDayStore(): ActiveDayStore {
  return useContext(ActiveDayContext);
}

export function useActiveDate(): string | null {
  const store = useActiveDayStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
