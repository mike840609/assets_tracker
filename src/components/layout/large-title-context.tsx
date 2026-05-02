"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

interface LargeTitleContextValue {
  isVisible: boolean;
  setIsVisible: (v: boolean) => void;
}

const LargeTitleContext = createContext<LargeTitleContextValue>({
  isVisible: true,
  setIsVisible: () => {},
});

export function LargeTitleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Co-locate the tracked pathname with isVisible so we can reset during render
  // without a useEffect (avoids the react-hooks/set-state-in-effect lint error).
  const [state, setState] = useState({ trackedPathname: pathname, isVisible: true });

  // Derived-state-from-props pattern: update during render when the route changes.
  // React processes this synchronously and re-renders once, without an extra paint.
  if (state.trackedPathname !== pathname) {
    setState({ trackedPathname: pathname, isVisible: true });
  }

  const setIsVisible = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isVisible: v }));
  }, []);

  const value = useMemo(
    () => ({ isVisible: state.isVisible, setIsVisible }),
    [state.isVisible, setIsVisible]
  );

  return (
    <LargeTitleContext.Provider value={value}>
      {children}
    </LargeTitleContext.Provider>
  );
}

export function useLargeTitle() {
  return useContext(LargeTitleContext);
}
