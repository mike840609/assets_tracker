"use client";

import { useEffect, useState, startTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick, getMonthTickInterval } from "@/lib/chart-formatters";
import { formatMonthLabel } from "@/lib/services/analysis-service";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import type { CategoryDataPoint } from "@/lib/services/analysis-service";

const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
];
const MAX_VISIBLE_CATEGORIES = 5;

interface Props {
  data: CategoryDataPoint[];
  baseCurrency: string;
  locale: string;
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

function CategoryTooltip({
  active,
  payload,
  label,
  baseCurrency,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  baseCurrency: string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <ChartTooltipContainer title={label} className="max-w-[200px]">
      {sorted.map((p) => (
        <ChartTooltipRow
          key={p.dataKey}
          label={p.name}
          value={privacyMode ? "***" : formatCurrency(p.value, baseCurrency)}
          indicatorColor={p.color}
        />
      ))}
    </ChartTooltipContainer>
  );
}

export function CategoryTrendChart({ data, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  // Collect unique categories present in the data, preserving insertion order.
  const categories = Array.from(
    new Set(
      data.flatMap((d) => Object.keys(d).filter((k) => k !== "monthKey" && Number(d[k]) > 0)),
    ),
  );

  const rankedCategories = categories
    .map((cat) => {
      const latest = Number(data.at(-1)?.[cat] ?? 0);
      const peak = Math.max(...data.map((d) => Number(d[cat] ?? 0)));
      return { cat, latest, peak };
    })
    .sort((a, b) => b.latest - a.latest || b.peak - a.peak);
  const visibleCategories = rankedCategories.slice(0, MAX_VISIBLE_CATEGORIES).map(({ cat }) => cat);
  const hiddenCategoryCount = Math.max(0, categories.length - visibleCategories.length);
  const chartData = data.map((d) => ({
    monthKey: d.monthKey,
    label: formatMonthLabel(d.monthKey as string, locale),
    ...Object.fromEntries(visibleCategories.map((cat) => [cat, Number(d[cat] ?? 0)])),
  }));
  const xAxisInterval = getMonthTickInterval(chartData.length, density === "compact" ? 5 : 6);

  // Compose aria-label: title + subtitle + visible category list, so AT users
  // get the series enumeration that role="img" hides from the inline Legend.
  const categoryNames = visibleCategories
    .map((cat) => tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat }))
    .join(", ");
  const ariaLabel =
    categoryNames.length > 0
      ? `${t("categoryTrend")}, ${t("categoryTrendSubtitle")} ${categoryNames}.`
      : `${t("categoryTrend")}, ${t("categoryTrendSubtitle")}`;

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("categoryTrend")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {hiddenCategoryCount > 0
            ? t("categoryTrendSubtitleLimited", {
                count: visibleCategories.length,
                total: categories.length,
              })
            : t("categoryTrendSubtitle")}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {visibleCategories.length === 0 ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            role="img"
            aria-label={ariaLabel}
            aria-hidden={privacyMode || undefined}
            className={`relative min-h-0 flex-1 transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 1, height: chartHeight }}
            >
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                {...crosshairHandlers}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  interval={xAxisInterval}
                  padding={{ left: 16, right: 16 }}
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  width={50}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                />
                <Tooltip
                  content={
                    <CategoryTooltip baseCurrency={baseCurrency} privacyMode={privacyMode} />
                  }
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{
                    fontSize: 12,
                    paddingTop: 8,
                    lineHeight: "18px",
                    width: "100%",
                  }}
                />
                {visibleCategories.map((cat, idx) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat })}
                    stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </>
  );
}
