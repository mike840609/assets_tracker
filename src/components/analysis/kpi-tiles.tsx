"use client";

import { useTranslations } from "next-intl";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { useCountUp } from "@/hooks/use-count-up";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { AnalysisKpis } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

interface Props {
  kpis: AnalysisKpis;
  baseCurrency: string;
  locale: string;
}

// Settles the figure to its value the way the dashboard hero does, so the strip
// reads as "freshly computed" on load and on each range change. Width is stable
// (tabular-nums) and the hook returns the final value under reduced motion.
function CountUpMoney({ amount, currency }: { amount: number; currency: string }) {
  const value = useCountUp(amount, 700);
  const sign = amount > 0 ? "+" : "";
  return <>{`${sign}${formatCurrency(value, currency)}`}</>;
}

function Tile({
  title,
  amount,
  currency,
  privacyMode,
  subtitle,
  tone,
  isCompact,
}: {
  title: string;
  amount: number | null;
  currency: string;
  privacyMode: boolean;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
  isCompact: boolean;
}) {
  // Data-first restraint: positives stay ink so the strip never reads as one
  // saturated block; only a real loss recolors the number. Direction is carried
  // by a caret (icon, not color alone) per the gain/loss design rule.
  const valueClass = tone === "negative" ? "text-[var(--loss)]" : "text-foreground";
  const DirIcon = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : null;
  const iconClass = tone === "positive" ? "text-[var(--gain)]" : "text-[var(--loss)]";
  return (
    <Card size={isCompact ? "sm" : "default"} className="min-w-0">
      <CardContent className={isCompact ? "space-y-1 min-w-0" : "space-y-1.5 min-w-0"}>
        <div className="text-xs text-muted-foreground font-medium truncate">{title}</div>
        <div className="overflow-x-auto scrollbar-none">
          <div
            className={`flex items-center gap-1 ${isCompact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} font-semibold tracking-tight tabular-nums whitespace-nowrap ${valueClass}`}
          >
            {DirIcon && (
              <DirIcon
                className={`${iconClass} ${isCompact ? "size-4" : "size-5"} shrink-0`}
                aria-hidden
              />
            )}
            <span>
              {privacyMode ? (
                "***"
              ) : amount === null ? (
                "—"
              ) : (
                <CountUpMoney amount={amount} currency={currency} />
              )}
            </span>
          </div>
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground tabular-nums truncate">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

function toneFor(n: number): "positive" | "negative" | "neutral" {
  if (n > 0) return "positive";
  if (n < 0) return "negative";
  return "neutral";
}

export function KpiTiles({ kpis, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";

  const bestSub =
    privacyMode || !kpis.best ? undefined : formatMonthLabel(kpis.best.monthKey, locale);
  const worstSub =
    privacyMode || !kpis.worst ? undefined : formatMonthLabel(kpis.worst.monthKey, locale);

  // When every month shares a sign, a "Worst Month" can be a gain (and a "Best
  // Month" a loss). Relabel to match the data so the title and value agree.
  const bestTitle =
    !privacyMode && kpis.best && kpis.best.deltaNetWorth < 0 ? t("smallestLoss") : t("bestMonth");
  const worstTitle =
    !privacyMode && kpis.worst && kpis.worst.deltaNetWorth >= 0
      ? t("smallestGain")
      : t("worstMonth");

  const ytdSub = privacyMode
    ? undefined
    : kpis.ytdPct === null
      ? undefined
      : `${kpis.ytdPct >= 0 ? "+" : ""}${kpis.ytdPct.toFixed(1)}%`;

  return (
    <div className={`grid grid-cols-2 ${isCompact ? "gap-2" : "gap-3 sm:gap-4"} md:grid-cols-4`}>
      <Tile
        title={bestTitle}
        amount={kpis.best ? kpis.best.deltaNetWorth : null}
        currency={baseCurrency}
        privacyMode={privacyMode}
        subtitle={bestSub}
        tone={privacyMode ? "neutral" : kpis.best ? toneFor(kpis.best.deltaNetWorth) : "neutral"}
        isCompact={isCompact}
      />
      <Tile
        title={worstTitle}
        amount={kpis.worst ? kpis.worst.deltaNetWorth : null}
        currency={baseCurrency}
        privacyMode={privacyMode}
        subtitle={worstSub}
        tone={privacyMode ? "neutral" : kpis.worst ? toneFor(kpis.worst.deltaNetWorth) : "neutral"}
        isCompact={isCompact}
      />
      <Tile
        title={t("avgMonthly")}
        amount={kpis.avgMonthlyDelta}
        currency={baseCurrency}
        privacyMode={privacyMode}
        tone={privacyMode ? "neutral" : toneFor(kpis.avgMonthlyDelta)}
        isCompact={isCompact}
      />
      <Tile
        title={t("ytdGrowth")}
        amount={kpis.ytdDelta}
        currency={baseCurrency}
        privacyMode={privacyMode}
        subtitle={ytdSub}
        tone={privacyMode ? "neutral" : toneFor(kpis.ytdDelta)}
        isCompact={isCompact}
      />
    </div>
  );
}
