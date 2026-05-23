"use client";

import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";

export function useCountUp(end: number, duration: number = 1000) {
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) return;
    let cancelled = false;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (cancelled) return;
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutCubic — decelerates the way iOS does
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(end * ease);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
    return () => {
      cancelled = true;
    };
  }, [end, duration, shouldReduceMotion]);

  return shouldReduceMotion ? end : count;
}
