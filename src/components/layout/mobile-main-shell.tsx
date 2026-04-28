"use client";

import { cn } from "@/lib/utils";
import { usePullToRefreshContext } from "./pull-to-refresh-context";

export function MobileMainShell({ children }: { children: React.ReactNode }) {
  const { pull, refreshing, hangOffset } = usePullToRefreshContext();
  const isPulling = pull > 0 && !refreshing;
  const offset = refreshing ? hangOffset : Math.min(pull, hangOffset);

  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 relative w-full",
        "overscroll-y-contain",
        isPulling ? "transition-none" : "transition-transform duration-300"
      )}
      style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
    >
      {children}
    </main>
  );
}
