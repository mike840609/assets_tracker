"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import type { PerformanceSummary as PerformanceSummaryType } from "@/lib/performance-utils";

function formatPeriodLabel(period: string): string {
  if (period.length === 7) {
    const [year, month] = period.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return period;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "neutral";
}) {
  const colorClass =
    color === "green"
      ? "text-green-500"
      : color === "red"
        ? "text-red-500"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function PerformanceSummaryCards({
  summary,
}: {
  summary: PerformanceSummaryType;
}) {
  const t = useTranslations("performance");

  const fmtPct = (v: number) => {
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {t("summaryTitle")}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("bestPeriod")}
          value={
            summary.bestPeriod ? fmtPct(summary.bestPeriod.changePercent) : "—"
          }
          sub={
            summary.bestPeriod
              ? formatPeriodLabel(summary.bestPeriod.period)
              : undefined
          }
          color="green"
        />
        <StatCard
          label={t("worstPeriod")}
          value={
            summary.worstPeriod
              ? fmtPct(summary.worstPeriod.changePercent)
              : "—"
          }
          sub={
            summary.worstPeriod
              ? formatPeriodLabel(summary.worstPeriod.period)
              : undefined
          }
          color="red"
        />
        <StatCard
          label={t("averageGrowth")}
          value={fmtPct(summary.averageChangePercent)}
          color={
            summary.averageChangePercent >= 0
              ? "green"
              : summary.averageChangePercent < 0
                ? "red"
                : "neutral"
          }
        />
        <StatCard
          label={t("periodsAnalyzed")}
          value={String(summary.totalPeriods)}
          color="neutral"
        />
      </div>
    </div>
  );
}
