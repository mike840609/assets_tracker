"use client";

import { useState, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

export function useCountUp(end: number, duration: number = 1000) {
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);
  // The value the next animation starts from. 0 on first mount gives the intro
  // count-up; afterward it holds the last displayed figure so a value change
  // (e.g. net worth after a price refresh) rolls from the previous number to the
  // new one — conveying the change — instead of snapping back to zero and
  // replaying the load animation.
  const fromRef = useRef(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      // The returned value is `end` via the ternary below, so there's nothing to
      // animate or set here; just remember it as the next start point.
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
      // easeOutCubic — decelerates the way iOS does
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
  }, [end, duration, shouldReduceMotion]);

  return shouldReduceMotion ? end : count;
}
