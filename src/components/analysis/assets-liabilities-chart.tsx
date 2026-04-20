"use client";

import { useEffect, useState } from "react";
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
import { EyeOff } from "lucide-react";
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
  useEffect(() => setMounted(true), []);

  const data = buckets.map((b) => ({
    label: formatMonthLabel(b.monthKey, locale),
    assets: b.totalAssets,
    liabilities: b.totalLiabilities,
    isEmpty: b.isEmpty,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("assetsVsLiabilities")}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div className="relative">
            <div className={`absolute inset-0 rounded-lg z-10 flex items-center justify-center transition-all duration-300 ${privacyMode ? "backdrop-blur-md bg-background/40 opacity-100" : "opacity-0 pointer-events-none"}`}>
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground select-none">
                <EyeOff className="h-5 w-5" />
                <span className="text-xs font-medium">Hidden</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  width={40}
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
                <Tooltip content={<AssetsTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />} />
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
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
