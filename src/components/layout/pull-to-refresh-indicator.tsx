"use client";

import { cn } from "@/lib/utils";
import { usePullToRefreshContext, HANG_OFFSET, THRESHOLD } from "./pull-to-refresh-context";

// Indicator pill: 36 × 36 px (h-9 w-9)
const INDICATOR_SIZE = 36;
// Vertical centre of the gap that the main shell opens above itself.
const INDICATOR_REST_Y = (HANG_OFFSET - INDICATOR_SIZE) / 2; // 8 px

// SVG arc geometry
const VIEWBOX = 28;
const CENTER = VIEWBOX / 2; // 14
const RADIUS = 11;
const STROKE = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 69.1 px

// The arc drawn while refreshing: a 270° (¾-circle) gap-less stroke that spins.
const REFRESH_ARC = CIRCUMFERENCE * 0.75;
const REFRESH_GAP = CIRCUMFERENCE * 0.25;

export function PullToRefreshIndicator() {
  const { pull, refreshing } = usePullToRefreshContext();
  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;
  const isPulling = pull > 0 && !refreshing;

  // Stroke-dashoffset for the filling arc:
  //   offset = CIRCUMFERENCE → nothing visible (progress 0)
  //   offset = 0             → full circle   (progress 1)
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  // Pill follows the finger while dragging; springs back/out with a transition.
  const translateY = refreshing
    ? INDICATOR_REST_Y
    : pull - INDICATOR_SIZE - 8; // enters the viewport from above

  // Subtle scale-up as the user pulls — "materialises" the pill.
  const scale = refreshing ? 1 : 0.75 + 0.25 * progress;

  return (
    <div
      className={cn(
        "md:hidden pointer-events-none fixed left-1/2 z-[60]",
        "flex items-center justify-center",
        "h-9 w-9 rounded-full",
        "bg-background/90 border border-border/50 shadow-lg backdrop-blur-md",
        // Only animate transform/opacity on release; follow finger with no lag.
        isPulling ? "transition-none" : "transition-[transform,opacity] duration-300 ease-out",
        // Hide entirely when idle so it never blocks taps.
        !refreshing && pull === 0 && "opacity-0"
      )}
      style={{
        top: 0,
        transform: `translate(-50%, ${translateY}px) scale(${scale})`,
        opacity: refreshing ? 1 : progress,
      }}
      aria-hidden
    >
      {/*
       * Spinning wrapper: rotate the whole SVG continuously while the network
       * request is in flight. A plain CSS `animate-spin` is used so the arc
       * colour and position remain under our control.
       */}
      <div className={refreshing ? "animate-spin" : undefined}>
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          width={VIEWBOX}
          height={VIEWBOX}
          // Rotate -90° so the arc path starts at 12 o'clock instead of 3 o'clock.
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Faint track ring — only shown while pulling to give context */}
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

          {/* Main arc — fills progressively while pulling; spins while refreshing */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={
              refreshing
                ? `${REFRESH_ARC} ${REFRESH_GAP}`
                : `${CIRCUMFERENCE}`
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
