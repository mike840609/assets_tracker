"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";

export type Density = "comfortable" | "compact";

interface DensityContextType {
  density: Density;
  setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextType>({
  density: "comfortable",
  setDensity: () => {},
});

const STORAGE_KEY = "asset-tracker:density";

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<Density>("comfortable");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    startTransition(() => {
      setMounted(true);
      if (stored === "compact") setDensityState("compact");
    });
  }, []);

  const setDensity = useCallback((next: Density) => {
    localStorage.setItem(STORAGE_KEY, next);
    startTransition(() => setDensityState(next));
  }, []);

  const value = useMemo(
    () => ({ density: mounted ? density : "comfortable", setDensity }),
    [mounted, density, setDensity],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  return useContext(DensityContext);
}
