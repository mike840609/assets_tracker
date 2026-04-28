"use client";

import { useEffect, useState } from "react";

interface Options {
  threshold?: number;
}

export function useHideOnScroll({ threshold = 64 }: Options = {}): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const main = document.querySelector("main");
    let lastY = 0;
    let touchStartY = 0;
    let frame = 0;
    let pending = false;

    const getScrollY = () => Math.max(main?.scrollTop ?? 0, window.scrollY);

    const flush = () => {
      pending = false;
      const y = getScrollY();
      if (y <= threshold) {
        setHidden(false);
      } else if (y > lastY) {
        setHidden(true);
      } else if (y < lastY) {
        setHidden(false);
      }
      lastY = y;
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(flush);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const delta = touchStartY - e.touches[0].clientY;
      if (getScrollY() <= threshold) return;
      if (delta > 10) setHidden(true);
      else if (delta < -10) setHidden(false);
    };

    main?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      main?.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [threshold]);

  return hidden;
}
