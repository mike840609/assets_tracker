"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useTranslations } from "next-intl";
import type { PerformancePeriod } from "@/lib/performance-utils";

function formatPeriodLabel(period: string): string {
  if (period.length === 7) {
    // "YYYY-MM" → "Jan 2024"
    const [year, month] = period.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  // "YYYY"
  return period;
}

interface TooltipPayload {
  payload: PerformancePeriod;
}

function CustomTooltip({
  active,
  payload,
  baseCurrency,
  t,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  baseCurrency: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: baseCurrency,
      maximumFractionDigits: 0,
    }).format(v);
  const sign = d.changePercent >= 0 ? "+" : "";
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-md space-y-1">
      <p className="font-semibold text-sm">{formatPeriodLabel(d.period)}</p>
      <p className="text-muted-foreground">
        {t("start")}: <span className="text-foreground">{fmt(d.startValue)}</span>
      </p>
      <p className="text-muted-foreground">
        {t("end")}: <span className="text-foreground">{fmt(d.endValue)}</span>
      </p>
      <p className="text-muted-foreground">
        {t("change")}:{" "}
        <span className={d.change >= 0 ? "text-green-500" : "text-red-500"}>
          {sign}{fmt(d.change)}
        </span>
      </p>
      <p className="text-muted-foreground">
        {t("changePercent")}:{" "}
        <span className={d.changePercent >= 0 ? "text-green-500" : "text-red-500"}>
          {sign}{d.changePercent.toFixed(2)}%
        </span>
      </p>
    </div>
  );
}

export function PerformanceChart({
  periods,
  baseCurrency = "USD",
}: {
  periods: PerformancePeriod[];
  baseCurrency?: string;
}) {
  const t = useTranslations("performance");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("chartTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {periods.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[300px]" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={periods} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11 }}
                tickFormatter={formatPeriodLabel}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <ReferenceLine y={0} className="stroke-border" strokeWidth={1} />
              <Tooltip
                content={
                  <CustomTooltip baseCurrency={baseCurrency} t={t} />
                }
              />
              <Bar dataKey="changePercent" name={t("changePercent")} radius={[3, 3, 0, 0]}>
                {periods.map((p, i) => (
                  <Cell
                    key={i}
                    fill={p.changePercent >= 0 ? "#22c55e" : "#ef4444"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
