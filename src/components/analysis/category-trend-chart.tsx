"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { formatMonthLabel } from "@/lib/services/analysis-service";
import type { CategoryDataPoint } from "@/lib/services/analysis-service";

const CATEGORY_COLORS = [
  "#3b82f6", // blue   — BANK
  "#10b981", // green  — BROKERAGE
  "#f59e0b", // amber  — CRYPTO_WALLET
  "#ef4444", // red    — PROPERTY
  "#8b5cf6", // violet — VEHICLE
  "#06b6d4", // cyan   — CREDIT_CARD
  "#ec4899", // pink   — LOAN
  "#84cc16", // lime   — MORTGAGE
  "#f97316", // orange — OTHER
];

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
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  baseCurrency: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1 max-w-[200px]">
      <div className="font-medium">{label}</div>
      {sorted.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="tabular-nums">{formatCurrency(p.value, baseCurrency)}</span>
        </div>
      ))}
    </div>
  );
}

const tickFormatter = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : String(v);

export function CategoryTrendChart({ data, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Collect unique categories present in the data, preserving insertion order.
  const categories = Array.from(
    new Set(
      data.flatMap((d) =>
        Object.keys(d).filter((k) => k !== "monthKey" && Number(d[k]) > 0)
      )
    )
  );

  const chartData = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.monthKey as string, locale),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("categoryTrend")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("categoryTrendSubtitle")}</p>
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
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={tickFormatter} />
              <Tooltip
                content={
                  <CategoryTooltip baseCurrency={baseCurrency} />
                }
              />
              {categories.map((cat, idx) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  name={tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat })}
                  stackId="1"
                  stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                  fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                  fillOpacity={0.6}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
