"use client";

import { useEffect, useState } from "react";

export function useChartAnimation(): boolean {
  const [isAnimationActive, setIsAnimationActive] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsAnimationActive(!reducedMotion.matches);

    const update = () => setIsAnimationActive(!reducedMotion.matches);
    reducedMotion.addEventListener("change", update);
    return () => reducedMotion.removeEventListener("change", update);
  }, []);

  return isAnimationActive;
}
