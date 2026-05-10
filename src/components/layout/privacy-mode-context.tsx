"use client";

import { useCallback, startTransition, useSyncExternalStore } from "react";
import { hapticTick } from "@/lib/haptics";

const PRIVACY_KEY = "privacy-mode";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  
  const handleStorage = (e: StorageEvent) => {
    if (e.key === PRIVACY_KEY) callback();
  };
  
  window.addEventListener("storage", handleStorage);
  window.addEventListener("privacy-mode-change", callback);
  
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("privacy-mode-change", callback);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PRIVACY_KEY) === "true";
}

function getServerSnapshot() {
  return false;
}

// Keep the provider as a no-op so we don't need to change layout.tsx
export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function usePrivacyMode() {
  const privacyMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const togglePrivacyMode = useCallback(() => {
    hapticTick();
    const next = window.localStorage.getItem(PRIVACY_KEY) !== "true";
    window.localStorage.setItem(PRIVACY_KEY, String(next));
    
    // Flip the visible state in a transition so the dozens of currency cells 
    // across the tree re-render without blocking the click -> paint cycle.
    startTransition(() => {
      window.dispatchEvent(new Event("privacy-mode-change"));
    });
  }, []);

  return { privacyMode, togglePrivacyMode };
}
