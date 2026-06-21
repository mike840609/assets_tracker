"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { FX_RATES_STALE_MS, SNAPSHOT_STALE_MS } from "@/lib/refresh-policy";
import { formatRelativeTime, formatRelativeTimeShort } from "@/lib/format-relative-time";

type FreshnessKind = "price" | "rates" | "snapshot";

interface FreshnessBadgeProps {
  timestamp: Date | string | null | undefined;
  kind: FreshnessKind;
  mobileShort?: boolean;
  /**
   * Render nothing while the timestamp is fresh — the badge becomes a pure
   * warning signal. Hidden on SSR/first paint (`now` starts null) and appears
   * right after mount, so server and client markup always match.
   */
  showOnlyWhenStale?: boolean;
  className?: string;
}

export function FreshnessBadge({
  timestamp,
  kind,
  mobileShort = false,
  showOnlyWhenStale = false,
  className,
}: FreshnessBadgeProps) {
  const t = useTranslations("freshness");
  const locale = useLocale();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialTimer = window.setTimeout(updateNow, 0);
    const intervalTimer = window.setInterval(updateNow, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, [timestamp]);

  if (!timestamp) return null;

  const displayNow = now ?? new Date(timestamp).getTime();
  const age = formatRelativeTime(timestamp, locale, displayNow);
  const shortAge = formatRelativeTimeShort(timestamp, locale, displayNow);
  // Prices refresh daily; older than 3 days reads as a trust caution (the 72h
  // window clears normal weekend gaps). FX rates use the shared 48h policy
  // threshold (two missed daily crons — Friday ECB rates stay stamped over
  // weekends). Snapshots use 48h — two missed daily crons is a real gap.
  const STALE_MS =
    kind === "rates"
      ? FX_RATES_STALE_MS
      : kind === "snapshot"
        ? SNAPSHOT_STALE_MS
        : 72 * 60 * 60 * 1000;
  const isStale = displayNow - new Date(timestamp).getTime() > STALE_MS;
  if (showOnlyWhenStale && !isStale) return null;
  const Icon = isStale
    ? TriangleAlert
    : kind === "snapshot"
      ? Camera
      : kind === "rates"
        ? RefreshCw
        : Clock;
  const longKey =
    kind === "snapshot" ? "snapshot" : kind === "rates" ? "ratesUpdated" : "pricesUpdated";
  const shortKey =
    kind === "snapshot"
      ? "snapshotMobile"
      : kind === "rates"
        ? "ratesUpdatedMobile"
        : "pricesUpdatedMobile";
  // Full localized sentence ("Prices updated 3 days ago") — used as the accessible
  // name so screen readers always get the subject, even when the visible chip is
  // abbreviated to "Prices 3d" on mobile.
  const fullLabel = t(longKey, { age });
  const hint = kind === "snapshot" ? t("snapshotHint") : undefined;
  const tone = isStale
    ? "border-warning/35 bg-warning/10 text-warning"
    : kind === "snapshot"
      ? "border-border/70 bg-muted/30"
      : "border-primary/25 bg-primary/5 text-primary-ink";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-xs whitespace-nowrap",
        tone,
        className,
      )}
      title={hint}
      aria-label={fullLabel}
      aria-live="polite"
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {mobileShort ? (
        <>
          <span className="sm:hidden">{t(shortKey, { age: shortAge })}</span>
          <span className="hidden sm:inline">{fullLabel}</span>
        </>
      ) : (
        <span>{fullLabel}</span>
      )}
    </span>
  );
}
