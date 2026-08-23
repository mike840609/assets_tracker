"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePullToRefreshContext } from "./pull-to-refresh-context";

export function PullToRefreshIndicator() {
  const { refreshing, registerIndicatorRef } = usePullToRefreshContext();

  return (
    <div
      className={cn(
        "md:hidden pointer-events-none fixed left-1/2 z-[60] flex items-center justify-center",
        "h-9 w-9 rounded-full bg-background/90 border border-border/50 shadow-md backdrop-blur-md",
        "opacity-0",
      )}
      style={{ top: "env(safe-area-inset-top)" }}
      ref={registerIndicatorRef}
      aria-hidden
    >
      <RefreshCw
        className={cn(
          "h-4 w-4",
          refreshing ? "animate-spin text-primary" : "text-muted-foreground",
        )}
      />
    </div>
  );
}
