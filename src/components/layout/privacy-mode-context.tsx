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
import { hapticTick } from "@/lib/haptics";

interface PrivacyModeContextType {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextType>({
  privacyMode: false,
  togglePrivacyMode: () => {},
});

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("privacy-mode");
    startTransition(() => {
      setMounted(true);
      setPrivacyMode(stored === "true");
    });
  }, []);

  // Persist synchronously, flip the visible state in a transition so the
  // dozens of currency cells across the tree re-render without blocking
  // the click → paint cycle (keeps INP under 200 ms).
  const togglePrivacyMode = useCallback(() => {
    hapticTick();
    const next = localStorage.getItem("privacy-mode") !== "true";
    localStorage.setItem("privacy-mode", String(next));
    startTransition(() => setPrivacyMode(next));
  }, []);

  const value = useMemo(
    () => ({ privacyMode: mounted ? privacyMode : false, togglePrivacyMode }),
    [mounted, privacyMode, togglePrivacyMode],
  );

  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}
