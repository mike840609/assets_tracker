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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { formatMonthLabel } from "@/lib/services/analysis-service";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
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
          <span className="tabular-nums">
            {privacyMode ? "***" : formatCurrency(p.value, baseCurrency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CategoryTrendChart({ data, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  useEffect(() => startTransition(() => setMounted(true)), []);

  // Collect unique categories present in the data, preserving insertion order.
  const categories = Array.from(
    new Set(
      data.flatMap((d) => Object.keys(d).filter((k) => k !== "monthKey" && Number(d[k]) > 0)),
    ),
  );

  const chartData = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.monthKey as string, locale),
  }));

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("categoryTrend")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("categoryTrendSubtitle")}</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div
            role="img"
            aria-label={`${t("categoryTrend")}, ${t("categoryTrendSubtitle")}`}
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 4, left: 0, bottom: 20 }}
                {...crosshairHandlers}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  padding={{ left: 16, right: 16 }}
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
                {categories.map((cat, idx) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat })}
                    stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
