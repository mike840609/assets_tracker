"use client";

import { useState, useEffect, startTransition } from "react";

export function usePersistedRange<T extends string>(key: string, initialValue: T) {
  const [range, setRange] = useState<T>(initialValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
      const stored = sessionStorage.getItem(`asset-tracker:range:${key}`);
      if (stored) {
        setRange(stored as T);
      }
    });
  }, [key]);

  const setPersistedRange = (newRange: T) => {
    setRange(newRange);
    try {
      sessionStorage.setItem(`asset-tracker:range:${key}`, newRange);
    } catch (_e) {
      // Ignore sessionStorage errors (e.g. quota exceeded, private mode)
    }
  };

  return [mounted ? range : initialValue, setPersistedRange] as const;
}
