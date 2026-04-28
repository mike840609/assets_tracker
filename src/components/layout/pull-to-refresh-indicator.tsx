"use client";

import { cn } from "@/lib/utils";
import { usePullToRefreshContext, HANG_OFFSET } from "./pull-to-refresh-context";

const THRESHOLD = 70;
// Vertical centre of the gap opened above the page (h-9 = 36px indicator)
const INDICATOR_REST_Y = (HANG_OFFSET - 36) / 2; // 8px

const SVG_SIZE = 24;
const R = 9;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 56.5

export function PullToRefreshIndicator() {
  const { pull, refreshing } = usePullToRefreshContext();
  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;
  const isPulling = pull > 0 && !refreshing;

  // Arc fills from 0→full as the user pulls; spinner shows 75% arc while loading
  const dashArray = refreshing
    ? `${CIRCUMFERENCE * 0.75} ${CIRCUMFERENCE * 0.25}`
    : String(CIRCUMFERENCE);
  const dashOffset = refreshing ? 0 : CIRCUMFERENCE * (1 - progress);

  return (
    <div
      className={cn(
        "md:hidden pointer-events-none fixed left-1/2 z-[60] flex items-center justify-center",
        "h-9 w-9 rounded-full bg-background/90 border border-border/50 shadow-md backdrop-blur-md",
        !refreshing && pull === 0 && "opacity-0",
        isPulling ? "transition-none" : "transition-[transform,opacity] duration-300"
      )}
      style={{
        top: 0,
        transform: refreshing
          ? `translate(-50%, ${INDICATOR_REST_Y}px)`
          : `translate(-50%, ${pull - 44}px)`,
        opacity: refreshing ? 1 : progress,
      }}
      aria-hidden
    >
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className={cn(refreshing && "animate-spin")}
      >
        {/* Background track — only shown while pulling so the spinner looks clean */}
        {!refreshing && (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={2}
            className="stroke-border/40"
          />
        )}
        {/* Filling arc (pull) / spinning arc (refresh) — starts at 12 o'clock */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${CX} ${CY})`}
          className={cn(
            armed || refreshing ? "stroke-primary" : "stroke-muted-foreground"
          )}
        />
      </svg>
    </div>
  );
}
