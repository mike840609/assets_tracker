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
import type { MonthlyBucket } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

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
}: {
  active?: boolean;
  payload?: Array<{ payload: AssetsTooltipEntry }>;
  baseCurrency: string;
  t: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  if (entry.isEmpty) {
    return (
      <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md">
        <div className="font-medium">{entry.label}</div>
        <div className="text-muted-foreground">{t("noDataMonth")}</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1">
      <div className="font-medium">{entry.label}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("seriesAssets")}</span>
        <span className="tabular-nums">{formatCurrency(entry.assets, baseCurrency)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("seriesLiabilities")}</span>
        <span className="tabular-nums">{formatCurrency(entry.liabilities, baseCurrency)}</span>
      </div>
    </div>
  );
}

export function AssetsLiabilitiesChart({ buckets, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
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
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  v >= 1000000
                    ? `${(v / 1000000).toFixed(1)}M`
                    : v >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : String(v)
                }
              />
              <Tooltip content={<AssetsTooltip baseCurrency={baseCurrency} t={t} />} />
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
        )}
      </CardContent>
    </Card>
  );
}
