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

export type StockColorScheme = "GREEN_UP" | "RED_UP";

const VALID_SCHEMES: StockColorScheme[] = ["GREEN_UP", "RED_UP"];
const STORAGE_KEY = "asset-tracker:stock-color-scheme";

interface StockColorSchemeContextType {
  stockColorScheme: StockColorScheme;
  setStockColorScheme: (scheme: StockColorScheme) => void;
}

const StockColorSchemeContext = createContext<StockColorSchemeContextType>({
  stockColorScheme: "GREEN_UP",
  setStockColorScheme: () => {},
});

function applyScheme(scheme: StockColorScheme) {
  if (scheme === "GREEN_UP") {
    delete document.documentElement.dataset.stockColorScheme;
  } else {
    document.documentElement.dataset.stockColorScheme = "red-up";
  }
}

export function StockColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const [stockColorScheme, setStockColorSchemeState] = useState<StockColorScheme>("GREEN_UP");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as StockColorScheme | null;
    const scheme = stored && VALID_SCHEMES.includes(stored) ? stored : "GREEN_UP";
    applyScheme(scheme);
    startTransition(() => {
      setMounted(true);
      setStockColorSchemeState(scheme);
    });
  }, []);

  const setStockColorScheme = useCallback((next: StockColorScheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyScheme(next);
    startTransition(() => setStockColorSchemeState(next));
  }, []);

  const value = useMemo(
    () => ({
      stockColorScheme: mounted ? stockColorScheme : "GREEN_UP",
      setStockColorScheme,
    }),
    [mounted, stockColorScheme, setStockColorScheme],
  );

  return (
    <StockColorSchemeContext.Provider value={value}>{children}</StockColorSchemeContext.Provider>
  );
}

export function useStockColorScheme() {
  return useContext(StockColorSchemeContext);
}
