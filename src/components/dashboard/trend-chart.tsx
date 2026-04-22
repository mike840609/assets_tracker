"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

type SnapshotData = {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
};

type TrendPoint = {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
};

function TrendTooltip({
  active,
  payload,
  label,
  baseCurrency,
  privacyMode,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  baseCurrency: string;
  privacyMode: boolean;
}) {
  if (!active || !payload?.length || !label) return null;

  const date = new Date(label);
  const formattedDate = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <ChartTooltipContainer title={formattedDate}>
      {payload.map((entry, i) => (
        <ChartTooltipRow
          key={i}
          label={entry.name}
          value={privacyMode ? "***" : formatCurrency(entry.value, baseCurrency)}
          indicatorColor={entry.color || entry.stroke}
        />
      ))}
    </ChartTooltipContainer>
  );
}

const ranges = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: Infinity },
];

export function TrendChart({ snapshots, baseCurrency = "USD", hideRangeFilter = false }: { snapshots: SnapshotData[]; baseCurrency?: string; hideRangeFilter?: boolean }) {
  const [range, setRange] = useState("All");
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("trendChart");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => setMounted(true), []);

  const selectedRange = ranges.find((r) => r.label === range)!;

  const filtered = useMemo(() => {
    if (hideRangeFilter || selectedRange.days === Infinity) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedRange.days);
    return snapshots.filter((s) => new Date(s.date) >= cutoff);
  }, [snapshots, selectedRange.days, hideRangeFilter]);

  const chartData: TrendPoint[] = useMemo(
    () =>
      filtered.map((point) => ({
        date: point.date,
        netWorth: point.netWorth,
        assets: point.totalAssets,
        liabilities: point.totalLiabilities,
      })),
    [filtered],
  );

  const series = [
    { dataKey: "netWorth", name: t("seriesNetWorth"), stroke: "var(--primary)", fill: "var(--primary)", fillOpacity: 0.12 },
    { dataKey: "assets", name: t("seriesAssets"), stroke: "var(--chart-2)", fill: "var(--chart-2)", fillOpacity: 0.08 },
    { dataKey: "liabilities", name: t("seriesLiabilities"), stroke: "var(--chart-5)", fill: "var(--chart-5)", fillOpacity: 0.06 },
  ] as const;

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
        {!hideRangeFilter && (
          <div className="flex gap-1">
            {ranges.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  range === r.label
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((item) => (
            <div key={item.dataKey} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: item.stroke }}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
        {!mounted ? (
          <div className="h-[250px] rounded-md bg-muted/30 animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-[250px] rounded-md border border-dashed border-border/60 bg-muted/20 flex items-center justify-center text-center text-muted-foreground text-sm px-4">
            {t("noData")}
          </div>
        ) : (
          <div className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  privacyMode
                    ? ""
                    : v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : v.toString()
                }
              />
              <Tooltip
                content={
                  <TrendTooltip
                    baseCurrency={baseCurrency}
                    privacyMode={privacyMode}
                  />
                }
              />
              {series.map((item) => (
                <Area
                  key={item.dataKey}
                  type="monotone"
                  dataKey={item.dataKey}
                  stroke={item.stroke}
                  fill={item.fill}
                  fillOpacity={item.fillOpacity}
                  strokeWidth={2}
                  name={item.name}
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
