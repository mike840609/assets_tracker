"use client";

import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  type Dispatch,
  type SetStateAction,
} from "react";

// Base hang space on devices without a notch:
//   MARGIN(8) + indicator(h-9 = 36px) + MARGIN(8) = 52 px
const BASE_HANG = 52;

// Damped pull distance (px) that triggers a refresh when the finger lifts.
export const THRESHOLD = 70;

function readSafeAreaTop(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sat");
  return parseFloat(raw) || 0;
}

interface PullToRefreshContextValue {
  pull: number;
  refreshing: boolean;
  /** Total px the main shell shifts down to reveal the indicator. */
  hangOffset: number;
  /** env(safe-area-inset-top) in px — 0 on flat-screen devices. */
  safeAreaTop: number;
  setPull: Dispatch<SetStateAction<number>>;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
}

const PullToRefreshContext = createContext<PullToRefreshContextValue>({
  pull: 0,
  refreshing: false,
  hangOffset: BASE_HANG,
  safeAreaTop: 0,
  setPull: () => {},
  setRefreshing: () => {},
});

export const usePullToRefreshContext = () => useContext(PullToRefreshContext);

export function PullToRefreshProvider({ children }: { children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [safeAreaTop, setSafeAreaTop] = useState(0);

  // Read the CSS --sat variable synchronously before first paint, and again
  // on orientation change / resize (safe-area insets can change on rotation).
  useLayoutEffect(() => {
    function update() {
      setSafeAreaTop(readSafeAreaTop());
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // hangOffset = safe-area height + fixed base space (indicator + margins).
  // On a flat-screen device: 0 + 52 = 52 px (same as before).
  // On iPhone with 44 px notch: 44 + 52 = 96 px.
  const hangOffset = safeAreaTop + BASE_HANG;

  return (
    <PullToRefreshContext.Provider
      value={{ pull, refreshing, hangOffset, safeAreaTop, setPull, setRefreshing }}
    >
      {children}
    </PullToRefreshContext.Provider>
  );
}
