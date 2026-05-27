"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { AnalysisKpis } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

interface Props {
  kpis: AnalysisKpis;
  baseCurrency: string;
  locale: string;
}

function Tile({
  title,
  value,
  subtitle,
  tone,
  isCompact,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
  isCompact: boolean;
}) {
  const valueClass =
    tone === "positive"
      ? "text-[var(--gain)]"
      : tone === "negative"
        ? "text-[var(--loss)]"
        : "text-foreground";
  return (
    <Card size="sm" className="min-w-0">
      <CardContent className={isCompact ? "space-y-1 p-3 min-w-0" : "space-y-1.5 min-w-0"}>
        <div className="text-xs text-muted-foreground font-medium truncate">{title}</div>
        <div className="overflow-x-auto scrollbar-none">
          <div
            className={`${isCompact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} font-semibold tracking-tight tabular-nums whitespace-nowrap ${valueClass}`}
          >
            {value}
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

function signed(n: number, currency: string): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatCurrency(n, currency)}`;
}

export function KpiTiles({ kpis, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const dash = "—";
  const hidden = "***";

  const bestValue = privacyMode
    ? hidden
    : kpis.best
      ? signed(kpis.best.deltaNetWorth, baseCurrency)
      : dash;
  const bestSub = privacyMode
    ? undefined
    : kpis.best
      ? formatMonthLabel(kpis.best.monthKey, locale)
      : undefined;
  const worstValue = privacyMode
    ? hidden
    : kpis.worst
      ? signed(kpis.worst.deltaNetWorth, baseCurrency)
      : dash;
  const worstSub = privacyMode
    ? undefined
    : kpis.worst
      ? formatMonthLabel(kpis.worst.monthKey, locale)
      : undefined;

  const ytdSub = privacyMode
    ? undefined
    : kpis.ytdPct === null
      ? undefined
      : `${kpis.ytdPct >= 0 ? "+" : ""}${kpis.ytdPct.toFixed(1)}%`;

  return (
    <div className={`grid grid-cols-2 ${isCompact ? "gap-2" : "gap-3 sm:gap-4"} md:grid-cols-4`}>
      <Tile
        title={t("bestMonth")}
        value={bestValue}
        subtitle={bestSub}
        tone={privacyMode ? "neutral" : kpis.best ? toneFor(kpis.best.deltaNetWorth) : "neutral"}
        isCompact={isCompact}
      />
      <Tile
        title={t("worstMonth")}
        value={worstValue}
        subtitle={worstSub}
        tone={privacyMode ? "neutral" : kpis.worst ? toneFor(kpis.worst.deltaNetWorth) : "neutral"}
        isCompact={isCompact}
      />
      <Tile
        title={t("avgMonthly")}
        value={privacyMode ? hidden : signed(kpis.avgMonthlyDelta, baseCurrency)}
        tone={privacyMode ? "neutral" : toneFor(kpis.avgMonthlyDelta)}
        isCompact={isCompact}
      />
      <Tile
        title={t("ytdGrowth")}
        value={privacyMode ? hidden : signed(kpis.ytdDelta, baseCurrency)}
        subtitle={ytdSub}
        tone={privacyMode ? "neutral" : toneFor(kpis.ytdDelta)}
        isCompact={isCompact}
      />
    </div>
  );
}
