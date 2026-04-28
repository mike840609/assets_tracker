"use client";

import { useEffect, useRef } from "react";
import { usePageTitle } from "@/contexts/page-title-context";

interface MobileLargeTitleProps {
  title: string;
}

// Approximately the height of the sticky mobile header (px-4 py-3 + icon).
// The negative rootMargin shrinks the observed root from the top so the
// observer fires "not intersecting" as soon as the heading scrolls behind
// the header — triggering the collapsed title in the nav bar.
const HEADER_HEIGHT_PX = 56;

export function MobileLargeTitle({ title }: MobileLargeTitleProps) {
  const { setTitle, setIsLargeTitleVisible } = usePageTitle();
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setTitle(title);
    setIsLargeTitleVisible(true);

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsLargeTitleVisible(entry.isIntersecting),
      {
        threshold: 0,
        rootMargin: `-${HEADER_HEIGHT_PX}px 0px 0px 0px`,
      }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      setIsLargeTitleVisible(true);
    };
  }, [title, setTitle, setIsLargeTitleVisible]);

  return (
    <h2
      ref={ref}
      className="text-3xl font-bold tracking-tight text-foreground"
    >
      {title}
    </h2>
  );
}
