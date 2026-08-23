"use client";

import { useEffect, useRef } from "react";
import { HANG_OFFSET, usePullToRefreshContext } from "./pull-to-refresh-context";
import { hapticTick } from "@/lib/haptics";

const THRESHOLD = 70;
const MAX_PULL = 120;

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export function dampedPull(deltaY: number): number {
  if (deltaY <= 0) return 0;
  return Math.min(deltaY * 0.5, MAX_PULL);
}

export function applyPullTransform(
  mainElement: HTMLElement,
  indicatorElement: HTMLElement,
  offset: number,
  isRefreshing: boolean,
): void {
  if (offset <= 0 && !isRefreshing) {
    mainElement.style.transform = "";
    indicatorElement.style.opacity = "0";
    indicatorElement.style.transform = "translate(-50%, 0px)";
    return;
  }

  const clampedOffset = Math.min(offset, HANG_OFFSET);
  mainElement.style.transform = clampedOffset > 0 ? `translateY(${clampedOffset}px)` : "";
  indicatorElement.style.opacity = String(Math.min(offset / THRESHOLD, 1));
  // Vertical centre of the gap opened above the page (h-9 = 36px indicator)
  const indicatorRestY = (HANG_OFFSET - 36) / 2;
  indicatorElement.style.transform = `translate(-50%, ${
    isRefreshing ? indicatorRestY : offset - 44
  }px)`;
}

export function PullToRefresh({ onRefresh, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { refreshing, setRefreshing, getMain, getIndicator } = usePullToRefreshContext();
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let startY = 0;
    let active = false;
    let currentPull = 0;
    let rafId: number | null = null;

    const resetPullTransform = () => {
      const mainElement = getMain();
      const indicatorElement = getIndicator();
      if (mainElement && indicatorElement) {
        applyPullTransform(mainElement, indicatorElement, 0, false);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current) return;
      const scrollTop = getMain()?.scrollTop ?? window.scrollY;
      if (scrollTop > 0) {
        active = false;
        return;
      }
      startY = event.touches[0].clientY;
      active = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!active || refreshingRef.current || reduceMotion) return;
      currentPull = dampedPull(event.touches[0].clientY - startY);
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const mainElement = getMain();
          const indicatorElement = getIndicator();
          if (mainElement && indicatorElement) {
            applyPullTransform(mainElement, indicatorElement, currentPull, refreshingRef.current);
          }
        });
      }
    };

    const onTouchEnd = async () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (!active || refreshingRef.current) {
        active = false;
        return;
      }
      active = false;
      if (currentPull >= THRESHOLD) {
        hapticTick();
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
      resetPullTransform();
      currentPull = 0;
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
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [getIndicator, getMain, onRefresh, setRefreshing]);

  return <div ref={wrapperRef}>{children}</div>;
}
