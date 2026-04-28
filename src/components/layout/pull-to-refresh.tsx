"use client";

import { useEffect, useRef } from "react";
import { usePullToRefreshContext, THRESHOLD } from "./pull-to-refresh-context";

// Maximum px the page visually shifts down while dragging.
const MAX_PULL = 120;

// Hyperbolic-tangent damping — gives a rubber-band feel that gets
// progressively harder to pull rather than a hard linear cap.
// At delta=0 → 0px, at delta≈140 → ~70px (threshold), asymptotes at MAX_PULL.
function dampPull(delta: number): number {
  return MAX_PULL * Math.tanh(delta / (MAX_PULL * 1.4));
}

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { refreshing, hangOffset, setPull, setRefreshing } = usePullToRefreshContext();

  // Keep hangOffset in a ref so the touchEnd closure always sees the latest
  // value without it appearing in the effect dependency array.
  const hangOffsetRef = useRef(hangOffset);
  useEffect(() => { hangOffsetRef.current = hangOffset; }, [hangOffset]);

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
    let wasArmed = false; // tracks threshold crossing for one-shot haptic

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      const scrollTop = main?.scrollTop ?? window.scrollY;
      if (scrollTop > 0) {
        active = false;
        return;
      }
      startY = e.touches[0].clientY;
      active = true;
      wasArmed = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || refreshing) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        currentPull = 0;
        setPull(0);
        return;
      }
      const damped = dampPull(delta);
      currentPull = damped;

      if (!reduceMotion) setPull(damped);

      // One-shot haptic tick the moment the pull crosses the trigger threshold.
      const isArmed = damped >= THRESHOLD;
      if (isArmed && !wasArmed) {
        navigator.vibrate?.(10);
      }
      wasArmed = isArmed;
    };

    const onTouchEnd = async () => {
      if (!active || refreshing) {
        active = false;
        return;
      }
      active = false;
      if (currentPull >= THRESHOLD) {
        setRefreshing(true);
        // Set pull to hangOffset (not just THRESHOLD) so the indicator
        // lands exactly at its resting position — especially important on
        // notched devices where hangOffset > THRESHOLD.
        setPull(hangOffsetRef.current);
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
      wasArmed = false;
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

  return <div ref={wrapperRef}>{children}</div>;
}
