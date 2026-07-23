"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface CountUpOptions {
  animateOnMount?: boolean;
}

export function useCountUp(
  end: number,
  duration: number = 1000,
  { animateOnMount = true }: CountUpOptions = {},
) {
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState(() => (animateOnMount ? 0 : end));
  const fromRef = useRef(animateOnMount ? 0 : end);
  const mountedRef = useRef(false);

  useEffect(() => {
    const firstRun = !mountedRef.current;
    mountedRef.current = true;

    if (shouldReduceMotion || (firstRun && !animateOnMount)) {
      setCount(end);
      fromRef.current = end;
      return;
    }

    const from = fromRef.current;
    let cancelled = false;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (cancelled) return;
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const value = from + (end - from) * ease;
      setCount(value);
      fromRef.current = value;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        fromRef.current = end;
      }
    };
    window.requestAnimationFrame(step);
    return () => {
      cancelled = true;
    };
  }, [animateOnMount, duration, end, shouldReduceMotion]);

  return shouldReduceMotion ? end : count;
}
