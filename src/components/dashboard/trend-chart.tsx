"use client";

import { useState, useEffect, useMemo, startTransition } from "react";
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

function TrendTooltip({
  active,
  payload,
  label,
  baseCurrency,
  privacyMode,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; stroke?: string }[];
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

export function TrendChart({
  snapshots,
  baseCurrency = "USD",
  hideRangeFilter = false,
}: {
  snapshots: SnapshotData[];
  baseCurrency?: string;
  hideRangeFilter?: boolean;
}) {
  const [range, setRange] = useState("All");
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("trendChart");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const selectedRange = ranges.find((r) => r.label === range)!;

  const filtered = useMemo(() => {
    if (hideRangeFilter || selectedRange.days === Infinity) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedRange.days);
    return snapshots.filter((s) => new Date(s.date) >= cutoff);
  }, [snapshots, selectedRange.days, hideRangeFilter]);

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
        {filtered.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[250px]" />
        ) : (
          <div
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={filtered}>
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
                  content={<TrendTooltip baseCurrency={baseCurrency} privacyMode={privacyMode} />}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name={t("seriesName")}
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
