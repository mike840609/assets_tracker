"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";

type FreshnessKind = "price" | "snapshot";

interface FreshnessBadgeProps {
  timestamp: Date | string | null | undefined;
  kind: FreshnessKind;
  mobileShort?: boolean;
  className?: string;
}

export function FreshnessBadge({
  timestamp,
  kind,
  mobileShort = false,
  className,
}: FreshnessBadgeProps) {
  const t = useTranslations("freshness");
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, [timestamp]);

  if (!timestamp) return null;

  const age = formatRelativeTime(timestamp, locale, now);
  const Icon = kind === "snapshot" ? Camera : Clock;
  const longKey = kind === "snapshot" ? "snapshot" : "pricesUpdated";
  const shortKey = kind === "snapshot" ? "snapshotMobile" : "pricesUpdatedMobile";
  const tone =
    kind === "snapshot"
      ? "border-border/70 bg-muted/30"
      : "border-primary/25 bg-primary/5 text-primary";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-xs whitespace-nowrap",
        tone,
        className,
      )}
      aria-live="polite"
    >
      <Icon className="h-3 w-3 shrink-0" />
      {mobileShort ? (
        <>
          <span className="sm:hidden">{t(shortKey, { age })}</span>
          <span className="hidden sm:inline">{t(longKey, { age })}</span>
        </>
      ) : (
        <span>{t(longKey, { age })}</span>
      )}
    </span>
  );
}
