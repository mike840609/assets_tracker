"use client";

import { useCallback, startTransition, useSyncExternalStore } from "react";
import { hapticTick } from "@/lib/haptics";
import { CLIENT_STORAGE_KEYS, readClientStorage, writeClientStorage } from "@/lib/client-storage";

const PRIVACY_KEY = CLIENT_STORAGE_KEYS.privacyMode;
const PRIVACY_VALUES = ["true", "false"] as const;

type PrivacyListener = () => void;

const privacyListeners = new Set<PrivacyListener>();

function notifyPrivacyListeners() {
  for (const listener of privacyListeners) listener();
}

function handlePrivacyStorage(event: StorageEvent) {
  if (event.key === PRIVACY_KEY.current) notifyPrivacyListeners();
}

function handlePrivacyModeChange() {
  notifyPrivacyListeners();
}

export function subscribeToPrivacyMode(callback: PrivacyListener) {
  if (typeof window === "undefined") return () => {};

  privacyListeners.add(callback);
  if (privacyListeners.size === 1) {
    window.addEventListener("storage", handlePrivacyStorage);
    window.addEventListener("privacy-mode-change", handlePrivacyModeChange);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    privacyListeners.delete(callback);
    if (privacyListeners.size === 0) {
      window.removeEventListener("storage", handlePrivacyStorage);
      window.removeEventListener("privacy-mode-change", handlePrivacyModeChange);
    }
  };
}

export function getPrivacyModeSnapshot() {
  if (typeof window === "undefined") return false;
  return readClientStorage(window.localStorage, PRIVACY_KEY, PRIVACY_VALUES) === "true";
}

export function getPrivacyModeServerSnapshot() {
  return false;
}

// Keep the provider as a no-op so we don't need to change layout.tsx
export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function usePrivacyMode() {
  const privacyMode = useSyncExternalStore(
    subscribeToPrivacyMode,
    getPrivacyModeSnapshot,
    getPrivacyModeServerSnapshot,
  );

  const togglePrivacyMode = useCallback(() => {
    hapticTick();
    const next = readClientStorage(window.localStorage, PRIVACY_KEY, PRIVACY_VALUES) !== "true";
    writeClientStorage(window.localStorage, PRIVACY_KEY, String(next));

    // Flip the visible state in a transition so the dozens of currency cells
    // across the tree re-render without blocking the click -> paint cycle.
    startTransition(() => {
      window.dispatchEvent(new Event("privacy-mode-change"));
    });
  }, []);

  return { privacyMode, togglePrivacyMode };
}
