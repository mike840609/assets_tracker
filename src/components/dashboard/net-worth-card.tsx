"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useCountUp } from "@/hooks/use-count-up";
import type { NetWorthSummary } from "@/lib/types";
import { TrendingUp, TrendingDown, Layers, Wallet } from "lucide-react";

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

  const animatedNetWorth = useCountUp(netWorth, 1200);
  const animatedAssets = useCountUp(totalAssets, 1000);
  const animatedLiabilities = useCountUp(totalLiabilities, 1000);

  const delta = previousNetWorth !== undefined ? netWorth - previousNetWorth : null;
  const pct =
    delta !== null && previousNetWorth !== undefined && previousNetWorth !== 0
      ? (delta / Math.abs(previousNetWorth)) * 100
      : null;

  const isPositive = delta !== null && delta >= 0;
  const deltaColor = delta === null ? "" : isPositive ? "text-primary" : "text-destructive";
  const bgDeltaColor = delta === null ? "" : isPositive ? "bg-primary/10" : "bg-destructive/10";
  const deltaSign = delta !== null && delta > 0 ? "+" : "";
  const meshClass = delta === null ? "" : isPositive ? "hero-mesh-positive" : "hero-mesh-negative";

  return (
    <div
      data-testid="net-worth-card"
      className={`grid grid-cols-2 lg:grid-cols-3 ${isCompact ? "gap-2 sm:gap-3" : "gap-3 sm:gap-6"} animate-in fade-in slide-in-from-bottom-4 motion-normal fill-mode-both`}
    >
      {/* Primary Hero Metric: Net Worth */}
      <Card className="col-span-2 lg:col-span-1 glass card-gradient rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all motion-normal hover:-translate-y-1 relative group min-w-0">
        {meshClass && <div className={meshClass} />}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary to-primary/50 opacity-100 transition-opacity" />
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
          <div className="overflow-x-auto scrollbar-none">
            <p
              className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mt-1 whitespace-nowrap tabular-nums"
              style={{ letterSpacing: "-0.02em" }}
            >
              {privacyMode ? HIDDEN : formatCurrency(animatedNetWorth, baseCurrency)}
            </p>
          </div>
          {!privacyMode && delta !== null && pct !== null && (
            <div className="overflow-x-auto scrollbar-none mt-3">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bgDeltaColor} ${deltaColor} w-max transition-all group-hover:scale-105 cursor-default whitespace-nowrap`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>
                  {deltaSign}
                  {formatCurrency(delta, baseCurrency)} ({deltaSign}
                  {pct.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary Metrics: Assets */}
      <Card className="col-span-1 glass card-gradient rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all motion-normal hover:-translate-y-1 min-w-0">
        <CardContent
          className={`${isCompact ? "p-2.5 sm:p-3" : "p-4 sm:p-6"} h-full flex flex-col justify-center min-w-0`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 whitespace-nowrap overflow-hidden">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {t("totalAssets")}
            </p>
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <p className="text-lg sm:text-2xl font-semibold text-primary mt-1 whitespace-nowrap tabular-nums">
              {privacyMode ? HIDDEN : formatCurrency(animatedAssets, baseCurrency)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Metrics: Liabilities */}
      <Card className="col-span-1 glass card-gradient rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all motion-normal hover:-translate-y-1 min-w-0">
        <CardContent
          className={`${isCompact ? "p-2.5 sm:p-3" : "p-4 sm:p-6"} h-full flex flex-col justify-center min-w-0`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 whitespace-nowrap overflow-hidden">
            <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {t("totalLiabilities")}
            </p>
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <p className="text-lg sm:text-2xl font-semibold text-destructive mt-1 whitespace-nowrap tabular-nums">
              {privacyMode ? HIDDEN : formatCurrency(animatedLiabilities, baseCurrency)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
