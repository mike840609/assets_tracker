"use client";

import { useState, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

export function useCountUp(end: number, duration: number = 1000) {
  const shouldReduceMotion = useReducedMotion();
  // Start at the real value so the first paint (SSR + hydration) already shows
  // the true figure. The dashboard net-worth headline is the LCP element;
  // starting at 0 and animating up delayed the *largest* text paint until after
  // the JS bundle hydrated (~5s on throttled mobile), pushing LCP past 5s.
  const [count, setCount] = useState(end);
  // The value the next animation starts from. Holds the last displayed figure so
  // a value change (e.g. net worth after a price refresh) rolls from the previous
  // number to the new one — conveying the change.
  const fromRef = useRef(end);
  // The intro count-up is intentionally skipped (see above); only value changes
  // *after* mount animate.
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // First mount: the value is already correct, so don't animate or re-set.
      mountedRef.current = true;
      fromRef.current = end;
      return;
    }

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
