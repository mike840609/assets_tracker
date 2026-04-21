"use client";

import { useEffect, useState } from "react";

export function useChartAnimation(): boolean {
  const [isAnimationActive, setIsAnimationActive] = useState(true);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setIsAnimationActive(!coarse.matches && !reducedMotion.matches);
    };

    update();
    coarse.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);

    return () => {
      coarse.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  return isAnimationActive;
}
