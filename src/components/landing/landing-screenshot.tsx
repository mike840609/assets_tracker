"use client";

import { useState } from "react";

type LandingScreenshotProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  orientation: "landscape" | "mobile";
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
  openLabel,
  fallbackLabel,
  fallbackHref,
  fallbackLinkLabel,
}: LandingScreenshotProps) {
  const [hasError, setHasError] = useState(false);
  const frameClassName =
    orientation === "mobile"
      ? "mx-auto aspect-[390/844] w-full max-w-[16rem] overflow-hidden rounded-xl border border-border/50 bg-muted/30 sm:max-w-[17rem]"
      : "aspect-[3/2] overflow-hidden rounded-xl border border-border/50 bg-muted/30";

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
      className={`${FOCUS_RING_CLASS} ${frameClassName} group relative block`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className={
          orientation === "mobile"
            ? "h-full w-full object-cover object-top"
            : "h-full w-full object-cover"
        }
      />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {openLabel}
      </span>
    </a>
  );
}
