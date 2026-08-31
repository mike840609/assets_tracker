"use client";

import type { ReactNode } from "react";
import { scrollToSection } from "@/components/landing/landing-nav";

type LandingScrollLinkProps = {
  href: string;
  label?: string;
  className: string;
  children: ReactNode;
};

/**
 * In-page links on the landing page cannot be plain anchors. The page scrolls
 * inside `#top` (h-dvh, overflow-y-auto) rather than the document, and native
 * anchor navigation scrolls the *document* to reach the target — which drags
 * the whole container out of view (window.scrollY 0 -> 165, container top
 * -165). Every section link routes through scrollToSection instead.
 */
export function LandingScrollLink({ href, label, className, children }: LandingScrollLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        window.history.pushState(null, "", href);
        scrollToSection(href);
      }}
      className={className}
    >
      {children}
    </a>
  );
}
