"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { formatChartTick } from "@/lib/chart-formatters";
import { formatCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

const DAYS_TO_SHOW = 30;

type SnapshotRow = {
  id: string;
  date: string;
  netWorth: number;
};

type DailyChangePoint = {
  date: string;
  label: string;
  longLabel: string;
  change: number;
  hasSnapshot: boolean;
  hasPreviousSnapshot: boolean;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
  className?: string;
};

type TooltipPayload = {
  payload: DailyChangePoint;
};

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DailyChangeTooltip({
  active,
  payload,
  baseCurrency,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  baseCurrency: string;
  privacyMode: boolean;
}) {
  const t = useTranslations("history");
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const isPositive = point.change >= 0;
  const isZero = point.change === 0;

  return (
    <ChartTooltipContainer title={point.longLabel}>
      {!point.hasSnapshot ? (
        <div className="text-[11px] text-muted-foreground">{t("noSnapshot")}</div>
      ) : !point.hasPreviousSnapshot ? (
        <div className="text-[11px] text-muted-foreground">{t("noPreviousSnapshot")}</div>
      ) : (
        <ChartTooltipRow
          label={t("colChange")}
          value={
            privacyMode
              ? "***"
              : `${isPositive ? "+" : ""}${formatCurrency(point.change, baseCurrency)}`
          }
          valueClassName={
            isZero
              ? "text-muted-foreground"
              : isPositive
                ? "text-[var(--gain)]"
                : "text-[var(--loss)]"
          }
        />
      )}
    </ChartTooltipContainer>
  );
}

export function DailyChangeChart({ snapshots, baseCurrency, className }: Props) {
  const t = useTranslations("history");
  const format = useFormatter();
  const { privacyMode } = usePrivacyMode();
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => startTransition(() => setMounted(true)), []);

  const data = useMemo(() => {
    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const changeByDate = new Map<string, { change: number; hasPreviousSnapshot: boolean }>();

    sortedSnapshots.forEach((snapshot, index) => {
      const previous = sortedSnapshots[index - 1];
      changeByDate.set(snapshot.date, {
        change: previous ? snapshot.netWorth - previous.netWorth : 0,
        hasPreviousSnapshot: !!previous,
      });
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (DAYS_TO_SHOW - 1));

    return Array.from({ length: DAYS_TO_SHOW }, (_, index): DailyChangePoint => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateString = isoDate(date);
      const snapshotChange = changeByDate.get(dateString);

      return {
        date: dateString,
        label: format.dateTime(date, { month: "numeric", day: "numeric" }),
        longLabel: format.dateTime(date, { dateStyle: "medium" }),
        change: snapshotChange?.change ?? 0,
        hasSnapshot: !!snapshotChange,
        hasPreviousSnapshot: snapshotChange?.hasPreviousSnapshot ?? false,
      };
    });
  }, [snapshots, format]);

  const hasAnyChange = data.some((point) => point.hasSnapshot && point.hasPreviousSnapshot);

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="pb-2 px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("dailyChange30")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-4 pb-4">
        {!hasAnyChange ? (
          <div className="flex flex-1 min-h-[180px] items-center justify-center text-center text-sm text-muted-foreground">
            {t("dailyChangeNoData")}
          </div>
        ) : !mounted ? (
          <div className="flex-1 min-h-[180px]" />
        ) : (
          <div
            role="img"
            aria-label={t("dailyChange30")}
            aria-hidden={privacyMode || undefined}
            className={cn(
              "relative flex-1 min-h-[180px] transition-[filter] duration-300",
              privacyMode && "blur-sm pointer-events-none select-none",
            )}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 1, height: 180 }}
            >
              <BarChart
                data={data}
                margin={{ top: 8, right: 2, left: 0, bottom: 8 }}
                {...crosshairHandlers}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                <XAxis
                  dataKey="label"
                  interval={6}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  width={42}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => (privacyMode ? "" : formatChartTick(value))}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  content={
                    <DailyChangeTooltip baseCurrency={baseCurrency} privacyMode={privacyMode} />
                  }
                />
                <Bar
                  dataKey="change"
                  radius={[3, 3, 3, 3]}
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={
                        !entry.hasSnapshot || !entry.hasPreviousSnapshot
                          ? "var(--muted-foreground)"
                          : entry.change === 0
                            ? "var(--muted-foreground)"
                            : entry.change > 0
                              ? "var(--gain)"
                              : "var(--loss)"
                      }
                      opacity={
                        !entry.hasSnapshot || !entry.hasPreviousSnapshot
                          ? 0.18
                          : entry.change === 0
                            ? 0.35
                            : 1
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
