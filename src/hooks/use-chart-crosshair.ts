"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { hapticTick } from "@/lib/haptics";

export function useChartCrosshair() {
  const [isActive, setIsActive] = useState(false);
  const lastIndexRef = useRef<string | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onTouchStart = useCallback(
    (state: { activeTooltipIndex?: number | string | null } | null | undefined) => {
      if (state?.activeTooltipIndex !== undefined) {
        lastIndexRef.current = String(state.activeTooltipIndex);
      }
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
      // Long press to activate crosshair mode
      pressTimerRef.current = setTimeout(() => {
        setIsActive(true);
        hapticTick();
      }, 400);
    },
    [],
  );

  const onTouchMove = useCallback(
    (state: { activeTooltipIndex?: number | string | null } | null | undefined) => {
      if (
        state?.activeTooltipIndex !== undefined &&
        String(state.activeTooltipIndex) !== lastIndexRef.current
      ) {
        lastIndexRef.current = String(state.activeTooltipIndex);
        if (isActive) {
          hapticTick();
        }
      }
    },
    [isActive],
  );

  const onTouchEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    setIsActive(false);
    lastIndexRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  return {
    isActive,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseEnter: onTouchStart,
      onMouseMove: onTouchMove,
      onMouseLeave: onTouchEnd,
    },
  };
}
