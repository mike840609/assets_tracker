"use client";

import { formatCurrency } from "@/lib/currencies";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useCountUp } from "@/hooks/use-count-up";
import type { NetWorthSummary } from "@/lib/types";
import { TrendingDown, TrendingUp } from "lucide-react";

const HIDDEN = "***";

export function NetWorthCard({
  summary,
  previousNetWorth,
}: {
  summary: NetWorthSummary;
  previousNetWorth?: number;
}) {
  const { totalAssets, totalLiabilities, netWorth, baseCurrency } = summary;
  const t = useTranslations("netWorthCard");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

  const animatedNetWorth = useCountUp(netWorth, 600);
  const animatedAssets = useCountUp(totalAssets, 500);
  const animatedLiabilities = useCountUp(totalLiabilities, 500);

  const delta = previousNetWorth !== undefined ? netWorth - previousNetWorth : null;
  const pct =
    delta !== null && previousNetWorth !== undefined && previousNetWorth !== 0
      ? (delta / Math.abs(previousNetWorth)) * 100
      : null;

  const isPositive = delta !== null && delta >= 0;
  const deltaSign = delta !== null && delta > 0 ? "+" : "";
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const deltaClass = delta === null ? "" : isPositive ? "text-primary" : "text-destructive";
  const deltaBgClass = delta === null ? "" : isPositive ? "bg-primary/10" : "bg-destructive/10";

  return (
    <section
      data-testid="net-worth-card"
      aria-labelledby="nw-label"
      className={`relative animate-in fade-in slide-in-from-bottom-4 motion-normal fill-mode-both ${
        isCompact ? "py-3" : "py-5 sm:py-7"
      }`}
    >
      <p
        id="nw-label"
        className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]"
      >
        {t("netWorth")}
      </p>

      <p
        className={`mt-2 font-bold text-foreground tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none leading-[1.05] ${
          isCompact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl lg:text-6xl"
        }`}
        style={{ letterSpacing: "-0.035em" }}
      >
        {privacyMode ? HIDDEN : formatCurrency(animatedNetWorth, baseCurrency)}
      </p>

      {!privacyMode && delta !== null && pct !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold tabular-nums ${deltaBgClass} ${deltaClass}`}
          >
            <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {deltaSign}
            {formatCurrency(delta, baseCurrency)}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${deltaClass}`}>
            {deltaSign}
            {pct.toFixed(2)}%
          </span>
        </div>
      )}

      <div
        className={`${isCompact ? "mt-4 pt-3" : "mt-6 pt-5"} border-t border-border/60 grid grid-cols-2 gap-x-8 gap-y-3`}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("totalAssets")}
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-semibold text-foreground tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">
            {privacyMode ? HIDDEN : formatCurrency(animatedAssets, baseCurrency)}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("totalLiabilities")}
          </span>
          <span className="mt-1 text-xl sm:text-2xl font-semibold text-foreground/70 tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">
            {privacyMode ? HIDDEN : formatCurrency(animatedLiabilities, baseCurrency)}
          </span>
        </div>
      </div>
    </section>
  );
}
