"use client";

import { createContext, useContext, useState, useEffect } from "react";

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
    setMounted(true);
    const stored = localStorage.getItem("privacy-mode");
    setPrivacyMode(stored === "true");
  }, []);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem("privacy-mode", String(next));
      return next;
    });
  };

  return (
    <PrivacyModeContext.Provider
      value={{ privacyMode: mounted ? privacyMode : false, togglePrivacyMode }}
    >
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}
