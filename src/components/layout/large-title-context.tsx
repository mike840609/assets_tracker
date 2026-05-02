"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  const [isVisible, setIsVisible] = useState(true);
  const pathname = usePathname();

  // Reset to "expanded" on every route change so the header shows the logo
  // even on pages that don't have a LargeTitleHeading.
  useEffect(() => {
    setIsVisible(true);
  }, [pathname]);

  return (
    <LargeTitleContext.Provider value={{ isVisible, setIsVisible }}>
      {children}
    </LargeTitleContext.Provider>
  );
}

export function useLargeTitle() {
  return useContext(LargeTitleContext);
}
