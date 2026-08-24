"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// Space opened above the header for the refresh indicator (8px margin + h-9 indicator + 8px margin)
export const HANG_OFFSET = 52;
export const INDICATOR_HIDDEN_Y = -44;
export const INDICATOR_REST_Y = (HANG_OFFSET - 36) / 2;

export const indicatorTranslate = (y: number) => `translate(-50%, ${y}px)`;

interface PullToRefreshContextValue {
  refreshing: boolean;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
  registerMainRef: (element: HTMLElement | null) => void;
  registerIndicatorRef: (element: HTMLElement | null) => void;
  getMain: () => HTMLElement | null;
  getIndicator: () => HTMLElement | null;
}

const PullToRefreshContext = createContext<PullToRefreshContextValue>({
  refreshing: false,
  setRefreshing: () => {},
  registerMainRef: () => {},
  registerIndicatorRef: () => {},
  getMain: () => null,
  getIndicator: () => null,
});

export const usePullToRefreshContext = () => useContext(PullToRefreshContext);

export function PullToRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const mainElementRef = useRef<HTMLElement | null>(null);
  const indicatorElementRef = useRef<HTMLElement | null>(null);

  const registerMainRef = useCallback((element: HTMLElement | null) => {
    mainElementRef.current = element;
  }, []);
  const registerIndicatorRef = useCallback((element: HTMLElement | null) => {
    indicatorElementRef.current = element;
  }, []);
  const getMain = useCallback(() => mainElementRef.current, []);
  const getIndicator = useCallback(() => indicatorElementRef.current, []);

  const contextValue = useMemo(
    () => ({
      refreshing,
      setRefreshing,
      registerMainRef,
      registerIndicatorRef,
      getMain,
      getIndicator,
    }),
    [refreshing, setRefreshing, registerMainRef, registerIndicatorRef, getMain, getIndicator],
  );

  return (
    <PullToRefreshContext.Provider value={contextValue}>{children}</PullToRefreshContext.Provider>
  );
}
