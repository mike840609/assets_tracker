"use client";

import { useCallback, useEffect, useState } from "react";

export function useChartAnimation(): { isAnimationActive: boolean; onAnimationEnd: () => void } {
  const [isAnimationActive, setIsAnimationActive] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsAnimationActive(!reducedMotion.matches);
  }, []);

  const onAnimationEnd = useCallback(() => {
    setIsAnimationActive(false);
  }, []);

  return { isAnimationActive, onAnimationEnd };
}
