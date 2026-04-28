"use client";

import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePullToRefreshContext, HANG_OFFSET } from "./pull-to-refresh-context";

const THRESHOLD = 70;
const MAX_PULL = 120;
// Vertical center of the HANG_OFFSET gap for the indicator circle (h-9 = 36px)
const INDICATOR_REST_Y = (HANG_OFFSET - 36) / 2; // 8px

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { pull, refreshing, setPull, setRefreshing } = usePullToRefreshContext();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const main = document.querySelector("main");
    let startY = 0;
    let active = false;
    let currentPull = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      const scrollTop = main?.scrollTop ?? window.scrollY;
      if (scrollTop > 0) {
        active = false;
        return;
      }
      startY = e.touches[0].clientY;
      active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || refreshing) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        currentPull = 0;
        setPull(0);
        return;
      }
      const damped = Math.min(delta * 0.5, MAX_PULL);
      currentPull = damped;
      if (!reduceMotion) setPull(damped);
    };

    const onTouchEnd = async () => {
      if (!active || refreshing) {
        active = false;
        return;
      }
      active = false;
      if (currentPull >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
          currentPull = 0;
        }
      } else {
        setPull(0);
        currentPull = 0;
      }
    };

    wrapper.addEventListener("touchstart", onTouchStart, { passive: true });
    wrapper.addEventListener("touchmove", onTouchMove, { passive: true });
    wrapper.addEventListener("touchend", onTouchEnd, { passive: true });
    wrapper.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      wrapper.removeEventListener("touchstart", onTouchStart);
      wrapper.removeEventListener("touchmove", onTouchMove);
      wrapper.removeEventListener("touchend", onTouchEnd);
      wrapper.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, refreshing, setPull, setRefreshing]);

  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;
  // true only while the finger is actively dragging (not yet released to trigger refresh)
  const isPulling = pull > 0 && !refreshing;

  return (
    <div ref={wrapperRef} className="relative">
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
        <RefreshCw
          className={cn(
            "h-4 w-4",
            refreshing && "animate-spin text-primary",
            !refreshing && armed && "text-primary",
            !refreshing && !armed && "text-muted-foreground"
          )}
          style={!refreshing ? { transform: `rotate(${progress * 270}deg)` } : undefined}
        />
      </div>
      {children}
    </div>
  );
}
