"use client";

import { usePullToRefreshContext } from "./pull-to-refresh-context";

export function MobileMainShell({ children }: { children: React.ReactNode }) {
  const { registerMainRef } = usePullToRefreshContext();

  return (
    <main
      className="relative w-full flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+1rem+env(safe-area-inset-bottom))] md:pb-0"
      ref={registerMainRef}
    >
      {children}
    </main>
  );
}
