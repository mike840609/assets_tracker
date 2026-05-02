"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useLargeTitle } from "./large-title-context";

interface Props {
  children: React.ReactNode;
  className?: string;
}

/**
 * Drop-in replacement for the page-level <h2> that drives the iOS 11+
 * large-title navigation bar pattern.
 *
 * On mobile: renders as a large (text-4xl) inline title and uses an
 * IntersectionObserver to tell MobileHeader when it has been scrolled
 * behind the sticky bar so the bar can collapse to a small centred title.
 *
 * On desktop: renders as the standard text-3xl heading, no observer wired up.
 */
export function LargeTitleHeading({ children, className }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { setIsVisible } = useLargeTitle();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // rootMargin shrinks the effective viewport from the top by 64 px so the
    // element is considered "not visible" the moment it slides behind the
    // ~56 px sticky header (plus a small buffer).
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [setIsVisible]);

  return (
    <h2
      ref={ref}
      className={cn(
        // mobile: iOS-style large title; desktop: existing size
        "text-4xl md:text-3xl font-bold tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </h2>
  );
}
