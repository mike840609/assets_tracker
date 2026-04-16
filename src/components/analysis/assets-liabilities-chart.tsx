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
import { createCurrencyTooltipFormatter } from "@/lib/chart-formatters";
import type { MonthlyBucket } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

interface Props {
  buckets: MonthlyBucket[];
  baseCurrency: string;
  locale: string;
}

export function AssetsLiabilitiesChart({ buckets, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = buckets.map((b) => ({
    label: formatMonthLabel(b.monthKey, locale),
    assets: b.totalAssets,
    liabilities: b.totalLiabilities,
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
              <Tooltip formatter={createCurrencyTooltipFormatter(baseCurrency)} />
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
