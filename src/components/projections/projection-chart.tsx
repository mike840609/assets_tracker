"use client";

import { useEffect, useState, startTransition } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

export interface ChartPoint {
  year: number;
  historical?: number;
  projected?: number;
}

interface Props {
  data: ChartPoint[];
  fireNumber: number;
  fireYear: number | null;
  baseCurrency: string;
}

function ProjectionTooltip({
  active,
  payload,
  label,
  baseCurrency,
  fireNumber,
  t,
  privacyMode,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string | number;
  baseCurrency: string;
  fireNumber: number;
  t: ReturnType<typeof useTranslations<"projections">>;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1">
      <div className="font-medium">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            {entry.name}
          </span>
          <span className="tabular-nums">
            {privacyMode ? "***" : formatCurrency(entry.value, baseCurrency, true)}
          </span>
        </div>
      ))}
      {fireNumber > 0 && (
        <div className="flex justify-between gap-4 border-t border-border/60 pt-1">
          <span className="text-muted-foreground">{t("chartFIRETarget")}</span>
          <span className="tabular-nums">
            {privacyMode ? "***" : formatCurrency(fireNumber, baseCurrency, true)}
          </span>
        </div>
      )}
    </div>
  );
}

export function ProjectionChart({ data, fireNumber, fireYear, baseCurrency }: Props) {
  const t = useTranslations("projections");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  const hasHistorical = data.some((d) => d.historical !== undefined);
  const hasProjected = data.some((d) => d.projected !== undefined);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("chart")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("chartSubtitle")}</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {data.length === 0 && (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        )}
        {data.length > 0 && !mounted && <div className="h-[320px]" />}
        {data.length > 0 && mounted && (
          <div
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis
                  width={64}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  label={{
                    value: `(${baseCurrency})`,
                    angle: -90,
                    position: "insideLeft",
                    offset: 14,
                    style: {
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                      textAnchor: "middle",
                    },
                  }}
                />
                <Tooltip
                  content={
                    <ProjectionTooltip
                      baseCurrency={baseCurrency}
                      fireNumber={fireNumber}
                      t={t}
                      privacyMode={privacyMode}
                    />
                  }
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />

                {fireNumber > 0 && (
                  <ReferenceLine
                    y={fireNumber}
                    stroke="var(--chart-4)"
                    strokeDasharray="6 3"
                    label={{
                      value: t("chartFIRETarget"),
                      position: "insideTopLeft",
                      fontSize: 11,
                      fill: "var(--chart-4)",
                    }}
                  />
                )}

                {fireYear && (
                  <ReferenceLine
                    x={fireYear}
                    stroke="var(--chart-4)"
                    strokeDasharray="4 3"
                    opacity={0.6}
                  />
                )}

                {hasHistorical && (
                  <Line
                    type="monotone"
                    dataKey="historical"
                    name={t("chartHistorical")}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                )}

                {hasProjected && (
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name={t("chartProjected")}
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
