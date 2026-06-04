"use client";

import { useEffect, useState, startTransition } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
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

interface AssetsTooltipEntry {
  label: string;
  isEmpty?: boolean;
  assets: number;
  liabilities: number;
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

  if (entry.isEmpty) {
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
        value={privacyMode ? "***" : formatCurrency(entry.liabilities, baseCurrency)}
        indicatorColor="var(--loss)"
      />
    </ChartTooltipContainer>
  );
}

export function AssetsLiabilitiesChart({ buckets, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 160 : 180;
  const [mounted, setMounted] = useState(false);
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const { handlers: crosshairHandlers } = useChartCrosshair();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const config: ChartConfig = {
    assets: { label: t("seriesAssets"), color: "var(--gain)" },
    liabilities: { label: t("seriesLiabilities"), color: "var(--loss)" },
  };

  const data = buckets.map((b) => ({
    label: formatMonthLabel(b.monthKey, locale),
    assets: b.totalAssets,
    liabilities: b.totalLiabilities,
    isEmpty: b.isEmpty,
  }));

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
            </div>
            <div
              role="img"
              aria-label={`${t("assetsVsLiabilities")}, ${t("assetsVsLiabilitiesSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={config}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <BarChart
                  data={data}
                  margin={{ top: 10, right: 4, left: 0, bottom: 20 }}
                  {...crosshairHandlers}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <AssetsTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />
                    }
                  />
                  <Bar
                    dataKey="assets"
                    fill="var(--color-assets)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  />
                  <Bar
                    dataKey="liabilities"
                    fill="var(--color-liabilities)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  />
                </BarChart>
              </ChartContainer>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("assetsVsLiabilitiesNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
}
