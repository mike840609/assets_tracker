"use client";

import { useCallback, useEffect, useState } from "react";

export function useChartAnimation(): { isAnimationActive: boolean; onAnimationEnd: () => void } {
  const [isAnimationActive, setIsAnimationActive] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsAnimationActive(true);
    }
  }, []);

  const onAnimationEnd = useCallback(() => setIsAnimationActive(false), []);

  return { isAnimationActive, onAnimationEnd };
}
