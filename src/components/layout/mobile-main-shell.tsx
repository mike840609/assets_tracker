"use client";

import { cn } from "@/lib/utils";
import { usePullToRefreshContext, HANG_OFFSET } from "./pull-to-refresh-context";

export function MobileMainShell({ children }: { children: React.ReactNode }) {
  const { pull, refreshing } = usePullToRefreshContext();
  // true only while finger is actively dragging — follow without transition lag
  const isPulling = pull > 0 && !refreshing;
  const offset = refreshing ? HANG_OFFSET : Math.min(pull, HANG_OFFSET);

  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+1rem+env(safe-area-inset-bottom))] md:pb-0 relative w-full",
        isPulling ? "transition-none" : "transition-transform duration-300",
      )}
      style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
    >
      {children}
    </main>
  );
}
