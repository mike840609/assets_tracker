"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
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
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "positive"
      ? "text-[var(--chart-1)]"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card size="sm">
      <CardContent className="space-y-1.5">
        <div className="text-xs text-muted-foreground font-medium">{title}</div>
        <div className={`text-2xl font-semibold tracking-tight tabular-nums ${valueClass}`}>
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground tabular-nums">{subtitle}</div>
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
  const dash = "—";

  const bestValue = kpis.best ? signed(kpis.best.deltaNetWorth, baseCurrency) : dash;
  const bestSub = kpis.best ? formatMonthLabel(kpis.best.monthKey, locale) : undefined;
  const worstValue = kpis.worst ? signed(kpis.worst.deltaNetWorth, baseCurrency) : dash;
  const worstSub = kpis.worst ? formatMonthLabel(kpis.worst.monthKey, locale) : undefined;

  const ytdSub =
    kpis.ytdPct === null ? undefined : `${kpis.ytdPct >= 0 ? "+" : ""}${kpis.ytdPct.toFixed(1)}%`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        title={t("bestMonth")}
        value={bestValue}
        subtitle={bestSub}
        tone={kpis.best ? toneFor(kpis.best.deltaNetWorth) : "neutral"}
      />
      <Tile
        title={t("worstMonth")}
        value={worstValue}
        subtitle={worstSub}
        tone={kpis.worst ? toneFor(kpis.worst.deltaNetWorth) : "neutral"}
      />
      <Tile
        title={t("avgMonthly")}
        value={signed(kpis.avgMonthlyDelta, baseCurrency)}
        tone={toneFor(kpis.avgMonthlyDelta)}
      />
      <Tile
        title={t("ytdGrowth")}
        value={signed(kpis.ytdDelta, baseCurrency)}
        subtitle={ytdSub}
        tone={toneFor(kpis.ytdDelta)}
      />
    </div>
  );
}
