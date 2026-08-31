"use client";

import Image from "next/image";
import { useState } from "react";

type LandingScreenshotProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  orientation: "landscape" | "mobile";
  /** Rendered width at each breakpoint, so the browser can pick a variant
   *  instead of downloading the 1430px original everywhere. A breakpoint where
   *  the frame is display:none gets `1px`: the fetch still happens, but it
   *  resolves to the smallest generated variant instead of the full file. */
  sizes: string;
  priority?: boolean;
  openLabel: string;
  fallbackLabel: string;
  fallbackHref: string;
  fallbackLinkLabel: string;
};

const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function LandingScreenshot({
  src,
  alt,
  width,
  height,
  orientation,
  sizes,
  priority = false,
  openLabel,
  fallbackLabel,
  fallbackHref,
  fallbackLinkLabel,
}: LandingScreenshotProps) {
  const [hasError, setHasError] = useState(false);
  const frameClassName =
    orientation === "mobile"
      ? "mx-auto aspect-[390/848] w-full max-w-[16rem] overflow-hidden rounded-xl border border-border/50 bg-muted/30 sm:max-w-[17rem]"
      : "overflow-hidden rounded-xl border border-border/50 bg-muted/30";
  const interactiveFrameClassName =
    "transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border focus-visible:border-border motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1";

  if (hasError) {
    return (
      <div
        aria-live="polite"
        className={`${frameClassName} flex flex-col items-center justify-center gap-3 p-6 text-center`}
      >
        <p className="text-sm text-muted-foreground">{fallbackLabel}</p>
        <a
          href={fallbackHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary hover:underline md:min-h-0`}
        >
          {fallbackLinkLabel}
        </a>
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${openLabel}: ${alt}`}
      title={openLabel}
      className={`${FOCUS_RING_CLASS} ${frameClassName} ${interactiveFrameClassName} group relative block`}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        onError={() => setHasError(true)}
        className={
          orientation === "mobile" ? "h-full w-full object-cover object-top" : "block h-auto w-full"
        }
      />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm transition duration-200 motion-safe:translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        {openLabel}
      </span>
    </a>
  );
}
