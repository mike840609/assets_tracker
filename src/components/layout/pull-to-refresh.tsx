"use client";

import { useEffect, useRef } from "react";
import { usePullToRefreshContext } from "./pull-to-refresh-context";
import { hapticTick } from "@/lib/haptics";

const THRESHOLD = 70;
const MAX_PULL = 120;

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
        hapticTick();
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

  return <div ref={wrapperRef}>{children}</div>;
}
