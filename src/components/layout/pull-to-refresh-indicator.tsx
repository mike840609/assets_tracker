"use client";

import { cn } from "@/lib/utils";
import { usePullToRefreshContext, THRESHOLD } from "./pull-to-refresh-context";

// Indicator pill matches h-9 w-9 = 36 px
const INDICATOR_SIZE = 36;
// Gap between the bottom of the safe-area (notch) and the top of the pill.
const INDICATOR_MARGIN = 8;

// SVG arc geometry
const VIEWBOX = 28;
const CENTER = VIEWBOX / 2; // 14
const RADIUS = 11;
const STROKE = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 69.1 px
const REFRESH_ARC = CIRCUMFERENCE * 0.75;
const REFRESH_GAP = CIRCUMFERENCE * 0.25;

export function PullToRefreshIndicator() {
  const { pull, refreshing, hangOffset, safeAreaTop } = usePullToRefreshContext();
  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;
  const isPulling = pull > 0 && !refreshing;

  const dashOffset = CIRCUMFERENCE * (1 - progress);

  // The pill should sit just below the safe-area (notch/status-bar).
  // On flat devices: safeAreaTop=0, so restY = 0 + 8 = 8 px (unchanged).
  // On notched iPhone (44 px): restY = 44 + 8 = 52 px — below the notch. ✓
  const restY = safeAreaTop + INDICATOR_MARGIN;

  // Interpolate position as the gap opens:
  //   gap=0          → fully hidden above viewport (−INDICATOR_SIZE)
  //   gap=hangOffset → at restY
  // This keeps the pill inside the visible gap at all pull distances.
  const gap = Math.min(pull, hangOffset);
  const t = hangOffset > 0 ? gap / hangOffset : 0;
  const translateY = refreshing
    ? restY
    : -INDICATOR_SIZE + t * (restY + INDICATOR_SIZE);

  // Scale reaches 1 once the gap is fully open.
  const scale = refreshing ? 1 : 0.75 + 0.25 * t;

  return (
    <div
      className={cn(
        "md:hidden pointer-events-none fixed left-1/2 z-[60]",
        "flex items-center justify-center",
        "h-9 w-9 rounded-full",
        "bg-background/90 border border-border/50 shadow-lg backdrop-blur-md",
        isPulling ? "transition-none" : "transition-[transform,opacity] duration-300 ease-out",
        !refreshing && pull === 0 && "opacity-0"
      )}
      style={{
        top: 0,
        transform: `translate(-50%, ${translateY}px) scale(${scale})`,
        opacity: refreshing ? 1 : progress,
      }}
      aria-hidden
    >
      <div className={refreshing ? "animate-spin" : undefined}>
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          width={VIEWBOX}
          height={VIEWBOX}
          style={{ transform: "rotate(-90deg)" }}
        >
          {!refreshing && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE - 0.5}
              className="text-border/50"
            />
          )}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={
              refreshing ? `${REFRESH_ARC} ${REFRESH_GAP}` : `${CIRCUMFERENCE}`
            }
            strokeDashoffset={refreshing ? 0 : dashOffset}
            className={cn(
              armed || refreshing ? "text-primary" : "text-muted-foreground/80"
            )}
          />
        </svg>
      </div>
    </div>
  );
}
