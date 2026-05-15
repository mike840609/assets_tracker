"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePullToRefreshContext, HANG_OFFSET } from "./pull-to-refresh-context";

const THRESHOLD = 70;
// Vertical centre of the gap opened above the page (h-9 = 36px indicator)
const INDICATOR_REST_Y = (HANG_OFFSET - 36) / 2; // 8px

export function PullToRefreshIndicator() {
  const { pull, refreshing } = usePullToRefreshContext();
  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;
  const isPulling = pull > 0 && !refreshing;

  return (
    <div
      className={cn(
        "md:hidden pointer-events-none fixed left-1/2 z-[60] flex items-center justify-center",
        "h-9 w-9 rounded-full bg-background/90 border border-border/50 shadow-md backdrop-blur-md",
        !refreshing && pull === 0 && "opacity-0",
        isPulling ? "transition-none" : "transition-[transform,opacity] duration-300",
      )}
      style={{
        top: "env(safe-area-inset-top)",
        transform: refreshing
          ? `translate(-50%, ${INDICATOR_REST_Y}px)`
          : `translate(-50%, ${pull - 44}px)`,
        opacity: refreshing ? 1 : progress,
      }}
      aria-hidden
    >
      <RefreshCw
        className={cn(
          "h-4 w-4",
          refreshing && "animate-spin text-primary",
          !refreshing && armed && "text-primary",
          !refreshing && !armed && "text-muted-foreground",
        )}
        style={!refreshing ? { transform: `rotate(${progress * 270}deg)` } : undefined}
      />
    </div>
  );
}
