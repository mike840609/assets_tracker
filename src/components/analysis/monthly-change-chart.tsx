"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { MonthlyBucket } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

interface Props {
  buckets: MonthlyBucket[];
  baseCurrency: string;
  locale: string;
  benchmarkData: Array<{ monthKey: string; value: number | null }>;
  benchmarkLabel: string;
}

interface TooltipPayload {
  payload: MonthlyBucket & { label: string; benchmarkValue: number | null };
}

function ChangeTooltip({
  active,
  payload,
  baseCurrency,
  t,
  privacyMode,
  benchmarkLabel,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  baseCurrency: string;
  t: (key: string) => string;
  privacyMode?: boolean;
  benchmarkLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;

  if (b.isEmpty) {
    return (
      <ChartTooltipContainer title={b.label}>
        <div className="text-[11px] text-muted-foreground">{t("noDataMonth")}</div>
      </ChartTooltipContainer>
    );
  }

  const pct =
    b.deltaPct === null ? "—" : `${b.deltaPct >= 0 ? "+" : ""}${b.deltaPct.toFixed(1)}%`;
  const sign = b.deltaNetWorth >= 0 ? "+" : "";

  return (
    <ChartTooltipContainer title={b.label}>
      {!privacyMode && (
        <>
          <ChartTooltipRow
            label={t("tooltipStart")}
            value={formatCurrency(b.startNetWorth, baseCurrency)}
          />
          <ChartTooltipRow
            label={t("tooltipEnd")}
            value={formatCurrency(b.endNetWorth, baseCurrency)}
          />
        </>
      )}
      <div className={!privacyMode ? "pt-1.5 mt-1.5 border-t border-border/40" : undefined}>
        <ChartTooltipRow
          label={t("tooltipChange")}
          value={
            privacyMode
              ? pct
              : `${sign}${formatCurrency(b.deltaNetWorth, baseCurrency)} (${pct})`
          }
          valueClassName={
            b.deltaNetWorth >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
          }
        />
        {b.benchmarkValue !== null && (
          <ChartTooltipRow
            label={benchmarkLabel}
            value={`${b.benchmarkValue.toFixed(1)}`}
            valueClassName="text-[var(--chart-4)]"
          />
        )}
      </div>
    </ChartTooltipContainer>
  );
}

export function MonthlyChangeChart({
  buckets,
  baseCurrency,
  locale,
  benchmarkData,
  benchmarkLabel,
}: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => setMounted(true), []);

  const benchmarkByMonth = new Map(benchmarkData.map((b) => [b.monthKey, b.value]));
  const data = buckets.map((b) => ({
    ...b,
    label: formatMonthLabel(b.monthKey, locale),
    benchmarkValue: benchmarkByMonth.get(b.monthKey) ?? null,
  }));

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("monthlyChange")}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
              <YAxis
                width={50}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  privacyMode
                    ? ""
                    : Math.abs(v) >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : Math.abs(v) >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : String(v)
                }
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                content={
                  <ChangeTooltip
                    baseCurrency={baseCurrency}
                    t={t}
                    privacyMode={privacyMode}
                    benchmarkLabel={benchmarkLabel}
                  />
                }
              />
              <Bar dataKey="deltaNetWorth" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.monthKey}
                    fill={
                      entry.isEmpty
                        ? "var(--muted-foreground)"
                        : entry.deltaNetWorth >= 0
                          ? "var(--chart-1)"
                          : "var(--destructive)"
                    }
                    opacity={entry.isEmpty ? 0.3 : 1}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="benchmarkValue"
                name={benchmarkLabel}
                stroke="var(--chart-4)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
