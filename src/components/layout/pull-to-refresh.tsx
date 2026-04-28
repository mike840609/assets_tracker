"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70;
const MAX_PULL = 120;

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
  }, [onRefresh, refreshing]);

  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={cn(
          "md:hidden pointer-events-none fixed left-1/2 z-[60] flex items-center justify-center",
          "h-9 w-9 rounded-full bg-background/90 border border-border/50 shadow-md backdrop-blur-md",
          !refreshing && pull === 0 && "opacity-0",
          refreshing ? "transition-transform duration-300" : "transition-none"
        )}
        style={{
          top: 0,
          transform: `translate(-50%, ${pull - 44}px)`,
          opacity: refreshing ? 1 : progress,
        }}
        aria-hidden
      >
        <RefreshCw
          className={cn(
            "h-4 w-4 text-primary",
            refreshing && "animate-spin",
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
