"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

// Space opened above the header for the refresh indicator (8px margin + h-9 indicator + 8px margin)
export const HANG_OFFSET = 52;
// Damped pull distance (px) that triggers a refresh when the finger lifts.
export const THRESHOLD = 70;

interface PullToRefreshContextValue {
  pull: number;
  refreshing: boolean;
  setPull: Dispatch<SetStateAction<number>>;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
}

const PullToRefreshContext = createContext<PullToRefreshContextValue>({
  pull: 0,
  refreshing: false,
  setPull: () => {},
  setRefreshing: () => {},
});

export const usePullToRefreshContext = () => useContext(PullToRefreshContext);

export function PullToRefreshProvider({ children }: { children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <PullToRefreshContext.Provider value={{ pull, refreshing, setPull, setRefreshing }}>
      {children}
    </PullToRefreshContext.Provider>
  );
}
