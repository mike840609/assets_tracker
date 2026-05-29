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
import { usePathname } from "next/navigation";

interface OnboardingContextType {
  open: boolean;
  /** Open the tour on demand (e.g. the "Show app tour" button in settings). */
  openTour: () => void;
  /** Close the tour and remember that it has been seen. */
  closeTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  open: false,
  openTour: () => {},
  closeTour: () => {},
});

const STORAGE_KEY = "asset-tracker:onboarding-seen";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Auto-show once, on the first dashboard visit, when never seen before.
  // Guarded by `mounted` so the server render never opens the dialog (avoids
  // hydration mismatch).
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      seen = true; // storage unavailable → don't nag
    }
    const shouldOpen = !seen && pathname === "/";
    startTransition(() => {
      setMounted(true);
      if (shouldOpen) setOpen(true);
    });
    // Only evaluate on first mount; replay is handled via openTour().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeTour = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    startTransition(() => setOpen(false));
  }, []);

  const openTour = useCallback(() => {
    startTransition(() => setOpen(true));
  }, []);

  const value = useMemo(
    () => ({ open: mounted && open, openTour, closeTour }),
    [mounted, open, openTour, closeTour],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
