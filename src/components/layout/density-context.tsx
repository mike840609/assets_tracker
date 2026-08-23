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
import { CLIENT_STORAGE_KEYS, readClientStorage, writeClientStorage } from "@/lib/client-storage";

export type Density = "comfortable" | "compact";

interface DensityContextType {
  density: Density;
  isReady: boolean;
  setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextType>({
  density: "comfortable",
  isReady: false,
  setDensity: () => {},
});

const STORAGE_KEY = CLIENT_STORAGE_KEYS.density;
const DENSITIES: Density[] = ["comfortable", "compact"];

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<Density>("comfortable");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readClientStorage(localStorage, STORAGE_KEY, DENSITIES);
    startTransition(() => {
      setMounted(true);
      if (stored === "compact") setDensityState("compact");
    });
  }, []);

  const setDensity = useCallback((next: Density) => {
    writeClientStorage(localStorage, STORAGE_KEY, next);
    startTransition(() => setDensityState(next));
  }, []);

  const value = useMemo(
    () => ({ density: mounted ? density : "comfortable", isReady: mounted, setDensity }),
    [mounted, density, setDensity],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  return useContext(DensityContext);
}
