"use client";

import { useEffect, useState, startTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
        indicatorColor="var(--chart-1)"
      />
      <ChartTooltipRow
        label={t("seriesLiabilities")}
        value={privacyMode ? "***" : formatCurrency(entry.liabilities, baseCurrency)}
        indicatorColor="var(--destructive)"
      />
    </ChartTooltipContainer>
  );
}

export function AssetsLiabilitiesChart({ buckets, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  const { isAnimationActive } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const data = buckets.map((b) => ({
    label: formatMonthLabel(b.monthKey, locale),
    assets: b.totalAssets,
    liabilities: b.totalLiabilities,
    isEmpty: b.isEmpty,
  }));

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("assetsVsLiabilities")}</CardTitle>
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
              <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                <YAxis
                  width={50}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) =>
                    privacyMode
                      ? ""
                      : v >= 1000000
                        ? `${(v / 1000000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : String(v)
                  }
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  content={<AssetsTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="assets"
                  name={t("seriesAssets")}
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="liabilities"
                  name={t("seriesLiabilities")}
                  fill="var(--destructive)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={isAnimationActive}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
