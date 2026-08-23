"use client";

import { memo, useEffect, useMemo, useState, startTransition } from "react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick, getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { MonthlyBucket } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";

interface Props {
  buckets: MonthlyBucket[];
  baseCurrency: string;
  locale: string;
}

const assetsLiabilitiesConfig = {} satisfies ChartConfig;

interface AssetsTooltipEntry {
  label: string;
  isEmpty?: boolean;
  assets: number | null;
  liabilities: number | null;
  netWorth: number | null;
}

function AssetsTooltip({
  active,
  payload,
  baseCurrency,
  t,
  privacyMode,
}: {
  active?: boolean;
  payload?: Array<{ payload: AssetsTooltipEntry }>;
  baseCurrency: string;
  t: (key: string) => string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;

  if (entry.isEmpty || entry.assets === null) {
    return (
      <ChartTooltipContainer title={entry.label}>
        <div className="text-[11px] text-muted-foreground">{t("noDataMonth")}</div>
      </ChartTooltipContainer>
    );
  }

  return (
    <ChartTooltipContainer title={entry.label}>
      <ChartTooltipRow
        label={t("seriesAssets")}
        value={privacyMode ? "***" : formatCurrency(entry.assets, baseCurrency)}
        indicatorColor="var(--gain)"
      />
      <ChartTooltipRow
        label={t("seriesLiabilities")}
        value={privacyMode ? "***" : formatCurrency(entry.liabilities ?? 0, baseCurrency)}
        indicatorColor="var(--loss)"
      />
      <div className="pt-1.5 mt-1.5 border-t border-border/40">
        <ChartTooltipRow
          label={t("seriesNetWorth")}
          value={privacyMode ? "***" : formatCurrency(entry.netWorth ?? 0, baseCurrency)}
          indicatorColor="var(--primary)"
        />
      </div>
    </ChartTooltipContainer>
  );
}

export const AssetsLiabilitiesChart = memo(function AssetsLiabilitiesChart({
  buckets,
  baseCurrency,
  locale,
}: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 160 : 180;
  const [mounted, setMounted] = useState(false);
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const { handlers: crosshairHandlers } = useChartCrosshair();
  useEffect(() => startTransition(() => setMounted(true)), []);

  // Liabilities are mirrored below the zero baseline to keep them legible next
  // to much larger assets; the dedicated net-worth line carries the
  // assets-minus-liabilities reading. Empty (padded) months become null so the
  // areas break instead of plunging to zero across gaps.
  const data = useMemo(
    () =>
      buckets.map((b) => ({
        label: formatMonthLabel(b.monthKey, locale),
        assets: b.isEmpty ? null : b.totalAssets,
        liabilities: b.isEmpty ? null : b.totalLiabilities,
        liabilitiesNeg: b.isEmpty ? null : -b.totalLiabilities,
        netWorth: b.isEmpty ? null : b.endNetWorth,
        isEmpty: b.isEmpty,
      })),
    [buckets, locale],
  );
  const xAxisInterval = getMonthTickInterval(data.length, density === "compact" ? 5 : 6);

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("assetsVsLiabilities")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("assetsVsLiabilitiesSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {data.length === 0 ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            className={`relative flex min-h-0 flex-1 flex-col transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <div className="mb-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--gain)" }}
                />
                {t("seriesAssets")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--loss)" }}
                />
                {t("seriesLiabilities")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                {t("seriesNetWorth")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("assetsVsLiabilities")}, ${t("assetsVsLiabilitiesSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={assetsLiabilitiesConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <AreaChart
                  data={data}
                  margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                  {...crosshairHandlers}
                >
                  <defs>
                    <linearGradient id="al-assets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gain)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--gain)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="al-liabilities" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="var(--loss)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    interval={xAxisInterval}
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                  <ChartTooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                    content={
                      <AssetsTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="assets"
                    stroke="var(--gain)"
                    strokeWidth={1.5}
                    fill="url(#al-assets)"
                    connectNulls={false}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  />
                  <Area
                    type="monotone"
                    dataKey="liabilitiesNeg"
                    stroke="var(--loss)"
                    strokeWidth={1.5}
                    fill="url(#al-liabilities)"
                    connectNulls={false}
                    isAnimationActive={isAnimationActive}
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={isAnimationActive}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
            <p className="sr-only">{t("assetsVsLiabilitiesNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
