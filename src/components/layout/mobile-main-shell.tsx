"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePullToRefreshContext, HANG_OFFSET } from "./pull-to-refresh-context";

export function MobileMainShell({ children }: { children: React.ReactNode }) {
  const { pull, refreshing } = usePullToRefreshContext();
  // true only while finger is actively dragging — follow without transition lag
  const isPulling = pull > 0 && !refreshing;
  const offset = refreshing ? HANG_OFFSET : Math.min(pull, HANG_OFFSET);

  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const scrollPositions = useRef(new Map<string, number>());

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const saved = scrollPositions.current.get(pathname);
    el.scrollTo({ top: saved ?? 0, behavior: "instant" });
    return () => {
      // Save scroll position of the route we're leaving
      scrollPositions.current.set(pathname, el.scrollTop);
    };
  }, [pathname]);

  return (
    <main
      ref={mainRef}
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 relative w-full",
        isPulling ? "transition-none" : "transition-transform duration-300",
      )}
      style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
    >
      {children}
    </main>
  );
}
