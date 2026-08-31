"use client";

import { useEffect, useRef, useState } from "react";

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

export function scrollToSection(href: string) {
  const scrollRoot = document.getElementById("top");
  const section = document.querySelector<HTMLElement>(href);
  if (!scrollRoot || !section) return;

  const scrollMarginTop = Number.parseFloat(getComputedStyle(section).scrollMarginTop);
  const top =
    section === scrollRoot
      ? 0
      : scrollRoot.scrollTop +
        section.getBoundingClientRect().top -
        scrollRoot.getBoundingClientRect().top -
        (Number.isFinite(scrollMarginTop) ? scrollMarginTop : 0);

  scrollRoot.scrollTo({
    top,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

type IndicatorBox = { left: number; top: number; width: number; height: number };

export function LandingNav({ items, label }: LandingNavProps) {
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<IndicatorBox | null>(null);
  const navRef = useRef<HTMLElement>(null);

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

  /* The active pill is one element that slides between links instead of blinking
     from one to the next, so scrolling reads as movement along the page. It is
     measured from the DOM because the row wraps to two lines on small screens;
     the ResizeObserver re-measures when that wrap changes. */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const place = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="location"]');
      setIndicator(
        active
          ? {
              left: active.offsetLeft,
              top: active.offsetTop,
              width: active.offsetWidth,
              height: active.offsetHeight,
            }
          : null,
      );
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeHref]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className="relative hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 md:flex md:flex-nowrap"
    >
      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-md bg-primary/15 transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{
            transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
            width: indicator.width,
            height: indicator.height,
          }}
        />
      ) : null}
      {items.map(({ href, label: itemLabel }) => {
        const isActive = activeHref === href;

        return (
          <a
            key={href}
            href={href}
            aria-current={isActive ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActiveHref(href);
              window.history.pushState(null, "", href);
              scrollToSection(href);
            }}
            className={`${FOCUS_RING_CLASS} relative flex h-11 shrink-0 items-center rounded-md px-2 text-sm font-medium transition-colors md:h-9 ${
              isActive
                ? "text-foreground"
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
