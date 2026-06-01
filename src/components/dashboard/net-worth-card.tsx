"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { useTranslations, useLocale } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useCountUp } from "@/hooks/use-count-up";
import type { NetWorthSummary } from "@/lib/types";
import { TrendingUp, TrendingDown, Layers, Wallet } from "lucide-react";

const HIDDEN = "***";

/**
 * Currency value that prefers the full number but falls back to the compact
 * form (e.g. $1.2M) when the full digits would overflow the available width.
 * An invisible, out-of-flow sibling holds the full string so its natural width
 * can be compared against the container without affecting layout.
 */
function FitCurrency({
  amount,
  currency,
  privacy,
  className,
}: {
  amount: number;
  currency: string;
  privacy: boolean;
  className?: string;
}) {
  const full = formatCurrency(amount, currency);
  const containerRef = useRef<HTMLParagraphElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    if (privacy) return;
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const check = () => setFits(measure.offsetWidth <= container.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [full, privacy]);

  return (
    <p ref={containerRef} className={className} title={privacy ? undefined : full}>
      {privacy ? HIDDEN : fits ? full : formatCurrency(amount, currency, true)}
      {!privacy && (
        <span
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
        >
          {full}
        </span>
      )}
    </p>
  );
}

export function NetWorthCard({
  summary,
  previousNetWorth,
  previousSnapshotDate,
}: {
  summary: NetWorthSummary;
  previousNetWorth?: number;
  previousSnapshotDate?: string;
}) {
  const { totalAssets, totalLiabilities, netWorth, baseCurrency } = summary;
  const t = useTranslations("netWorthCard");
  const locale = useLocale();
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

  const animatedNetWorth = useCountUp(netWorth, 600);

  const delta = previousNetWorth !== undefined ? netWorth - previousNetWorth : null;
  const pct =
    delta !== null && previousNetWorth !== undefined && previousNetWorth !== 0
      ? (delta / Math.abs(previousNetWorth)) * 100
      : null;

  const isPositive = delta !== null && delta >= 0;
  const deltaColor = delta === null ? "" : isPositive ? "text-[var(--gain)]" : "text-[var(--loss)]";
  const bgDeltaColor =
    delta === null ? "" : isPositive ? "bg-[var(--gain)]/10" : "bg-[var(--loss)]/10";
  const deltaSign = delta !== null && delta > 0 ? "+" : "";
  const snapshotLabel = previousSnapshotDate
    ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
        new Date(previousSnapshotDate),
      )
    : null;
  const meshClass =
    delta === null ? "hero-mesh-neutral" : isPositive ? "hero-mesh-positive" : "hero-mesh-negative";

  return (
    <div
      data-testid="net-worth-card"
      className={`grid grid-cols-2 lg:grid-cols-3 ${isCompact ? "gap-2 sm:gap-3" : "gap-3 sm:gap-6"} animate-in fade-in slide-in-from-bottom-4 motion-normal fill-mode-both`}
    >
      {/* Primary Hero Metric: Net Worth */}
      <Card className="col-span-2 lg:col-span-1 glass card-gradient rounded-2xl overflow-hidden shadow-sm relative min-w-0">
        <div className={meshClass} />
        <div className="net-worth-card-accent absolute inset-x-0 bottom-0 h-1 opacity-100 transition-opacity" />
        <CardContent
          className={`${isCompact ? "p-2.5 sm:p-3" : "p-4 sm:p-6"} h-full flex flex-col justify-center min-w-0 relative z-10`}
        >
          <div className="flex items-center gap-2.5 mb-1.5 whitespace-nowrap overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {t("netWorth")}
            </p>
          </div>
          <p
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mt-1 whitespace-nowrap tabular-nums truncate"
            style={{ letterSpacing: "-0.02em" }}
            title={privacyMode ? undefined : formatCurrency(netWorth, baseCurrency)}
          >
            {privacyMode ? HIDDEN : formatCurrency(animatedNetWorth, baseCurrency)}
          </p>
          {!privacyMode && delta !== null && pct !== null && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bgDeltaColor} ${deltaColor} max-w-full cursor-default tabular-nums`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {deltaSign}
                    {formatCurrency(delta, baseCurrency)}
                  </span>
                </div>
                <span className={`text-xs font-semibold tabular-nums ${deltaColor}`}>
                  {deltaSign}
                  {pct.toFixed(2)}%
                </span>
              </div>
              {snapshotLabel && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t("sinceSnapshot", { date: snapshotLabel })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary Metrics: Assets — quiet wash so the hero leads */}
      <Card className="col-span-1 rounded-2xl bg-muted/30 min-w-0">
        <CardContent
          className={`${isCompact ? "p-2.5 sm:p-3" : "p-4 sm:p-6"} h-full flex flex-col justify-center min-w-0`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 whitespace-nowrap overflow-hidden">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--gain)] shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {t("totalAssets")}
            </p>
          </div>
          <FitCurrency
            amount={totalAssets}
            currency={baseCurrency}
            privacy={privacyMode}
            className="relative text-lg sm:text-2xl font-semibold text-[var(--gain)] mt-1 whitespace-nowrap tabular-nums truncate"
          />
        </CardContent>
      </Card>

      {/* Secondary Metrics: Liabilities — quiet wash so the hero leads */}
      <Card className="col-span-1 rounded-2xl bg-muted/30 min-w-0">
        <CardContent
          className={`${isCompact ? "p-2.5 sm:p-3" : "p-4 sm:p-6"} h-full flex flex-col justify-center min-w-0`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 whitespace-nowrap overflow-hidden">
            <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--loss)] shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {t("totalLiabilities")}
            </p>
          </div>
          <FitCurrency
            amount={totalLiabilities}
            currency={baseCurrency}
            privacy={privacyMode}
            className="relative text-lg sm:text-2xl font-semibold text-[var(--loss)] mt-1 whitespace-nowrap tabular-nums truncate"
          />
        </CardContent>
      </Card>
    </div>
  );
}
