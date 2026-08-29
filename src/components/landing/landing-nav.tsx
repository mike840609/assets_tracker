"use client";

import { useEffect, useState } from "react";

type LandingNavItem = {
  href: string;
  label: string;
};

type LandingNavProps = {
  items: readonly LandingNavItem[];
  label: string;
};

const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function LandingNav({ items, label }: LandingNavProps) {
  const [activeHref, setActiveHref] = useState<string | null>(null);

  useEffect(() => {
    const scrollRoot = document.getElementById("top");
    if (!scrollRoot) return;

    const sections = items
      .map(({ href }) => document.querySelector<HTMLElement>(href))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visibleSection?.target instanceof HTMLElement) {
          setActiveHref(`#${visibleSection.target.id}`);
        }
      },
      { root: scrollRoot, rootMargin: "-15% 0px -65% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label={label}
      className="order-3 -mx-1 flex w-full min-w-0 flex-wrap items-center gap-0.5 pb-0 md:order-none md:mx-0 md:w-auto md:flex-1 md:flex-nowrap md:justify-center"
    >
      {items.map(({ href, label: itemLabel }) => {
        const isActive = activeHref === href;

        return (
          <a
            key={href}
            href={href}
            aria-current={isActive ? "location" : undefined}
            onClick={() => setActiveHref(href)}
            className={`${FOCUS_RING_CLASS} flex h-11 shrink-0 items-center rounded-md px-2 text-sm font-medium transition-colors md:h-9 ${
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {itemLabel}
          </a>
        );
      })}
    </nav>
  );
}
