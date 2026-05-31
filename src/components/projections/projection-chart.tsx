"use client";

import { useEffect, useId, useState, startTransition } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

export interface ChartPoint {
  year: number;
  historical?: number;
  projected?: number;
  projectedReal?: number;
}

type Lens = "nominal" | "real";

interface Props {
  data: ChartPoint[];
  fireNumber: number;
  fireYear: number | null;
  baseCurrency: string;
  lens: Lens;
  height?: number;
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
    <div className="space-y-1.5 rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
      <div className="font-semibold tabular-nums">{label}</div>
      {payload
        .filter((entry) => entry.value != null)
        .map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums">
              {privacyMode ? "***" : formatCurrency(entry.value, baseCurrency, true)}
            </span>
          </div>
        ))}
      {fireNumber > 0 && (
        <div className="flex items-center justify-between gap-6 border-t border-border/60 pt-1.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-0.5 w-3 rounded-full bg-muted-foreground/70" />
            {t("chartFIRETarget")}
          </span>
          <span className="font-medium tabular-nums">
            {privacyMode ? "***" : formatCurrency(fireNumber, baseCurrency, true)}
          </span>
        </div>
      )}
    </div>
  );
}

export function ProjectionChart({
  data,
  fireNumber,
  fireYear,
  baseCurrency,
  lens,
  height = 360,
}: Props) {
  const t = useTranslations("projections");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  const gradientId = useId();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const projectedKey = lens === "real" ? "projectedReal" : "projected";
  const projectedName = lens === "real" ? t("chartReal") : t("chartProjected");
  const hasHistorical = data.some((d) => d.historical != null);
  const hasProjected = data.some((d) => d[projectedKey] != null);

  // Value of the projected series at the FIRE crossing, for the marker dot.
  const fireValue =
    fireYear != null ? (data.find((d) => d.year === fireYear)?.[projectedKey] ?? fireNumber) : null;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        {t("noData")}
      </div>
    );
  }

  if (!mounted) return <div style={{ height }} />;

  return (
    <div
      className={`relative transition-[filter] duration-300 ${
        privacyMode ? "pointer-events-none select-none blur-sm" : ""
      }`}
    >
      <ResponsiveContainer
        width="100%"
        height={height}
        minWidth={0}
        initialDimension={{ width: 1, height }}
      >
        <ComposedChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="2 4" className="stroke-border/50" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={
              <ProjectionTooltip
                baseCurrency={baseCurrency}
                fireNumber={fireNumber}
                t={t}
                privacyMode={privacyMode}
              />
            }
          />

          {fireNumber > 0 && (
            <ReferenceLine
              y={fireNumber}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              strokeOpacity={0.7}
              label={{
                value: t("target"),
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          )}

          {hasHistorical && (
            <Line
              type="monotone"
              dataKey="historical"
              name={t("chartHistorical")}
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {hasProjected && (
            <Area
              type="monotone"
              dataKey={projectedKey}
              name={projectedName}
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {fireYear != null && fireValue != null && (
            <ReferenceDot
              x={fireYear}
              y={fireValue}
              r={5}
              fill="var(--chart-1)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
