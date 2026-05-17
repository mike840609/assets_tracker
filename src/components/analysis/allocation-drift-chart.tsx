"use client";

import { useEffect, useState, startTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AllocationDriftItem } from "@/lib/types";

interface Props {
  items: AllocationDriftItem[];
}

function DriftTooltip({
  active,
  payload,
  t,
}: {
  active?: boolean;
  payload?: { payload: AllocationDriftItem }[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const sign = item.drift >= 0 ? "+" : "";
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1 min-w-[180px]">
      <div className="font-medium leading-tight">{item.label}</div>
      <div className="border-t border-border/60 pt-1 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("allocationActual")}</span>
          <span className="tabular-nums">{item.actualPercent.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("allocationTarget")}</span>
          <span className="tabular-nums">{item.targetPercent.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/60 pt-1">
          <span className="text-muted-foreground">{t("allocationDrift")}</span>
          <span
            className={`tabular-nums font-medium ${
              item.isOverThreshold ? "text-destructive" : "text-[var(--chart-1)]"
            }`}
          >
            {sign}
            {item.drift.toFixed(1)} pp
          </span>
        </div>
        {item.isOverThreshold && (
          <div className="text-destructive/80 text-[11px]">
            {t("allocationAlertHint", { threshold: item.driftThreshold.toFixed(1) })}
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_LABEL_LEN = 14;
const truncate = (s: string) =>
  s.length > MAX_LABEL_LEN ? s.slice(0, MAX_LABEL_LEN - 1) + "…" : s;

export function AllocationDriftChart({ items }: Props) {
  const t = useTranslations("analysis");
  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  const alertCount = items.filter((i) => i.isOverThreshold).length;
  const chartHeight = Math.max(200, items.length * 44 + 40);

  // Sort: over-threshold first, then by |drift| desc
  const chartData = [...items].sort((a, b) => {
    if (a.isOverThreshold !== b.isOverThreshold) return a.isOverThreshold ? -1 : 1;
    return Math.abs(b.drift) - Math.abs(a.drift);
  });

  if (items.length === 0) {
    return (
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="pb-2 px-2 sm:px-4">
          <CardTitle className="text-base font-medium text-foreground">
            {t("allocationDriftTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
            {t("allocationDriftNoTargets")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium text-foreground">
            {t("allocationDriftTitle")}
          </CardTitle>
          {alertCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
              {t("allocationAlertBadge", { count: alertCount })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("allocationDriftSubtitle")}</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {!mounted ? (
          <div style={{ height: chartHeight }} />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}pp`}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickFormatter={truncate}
                width={100}
              />
              <ReferenceLine x={0} stroke="var(--border)" strokeWidth={1.5} label="" />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                content={<DriftTooltip t={t} />}
              />
              <Bar dataKey="drift" radius={[0, 4, 4, 0]}>
                {chartData.map((item, idx) => (
                  <Cell
                    key={`${item.scope}-${item.key}-${idx}`}
                    fill={
                      item.isOverThreshold
                        ? "var(--destructive)"
                        : item.drift >= 0
                          ? "var(--chart-2)"
                          : "var(--chart-1)"
                    }
                  />
                ))}
                <LabelList
                  dataKey="drift"
                  position="right"
                  fontSize={11}
                  formatter={(v: unknown) => {
                    const n = Number(v);
                    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}pp`;
                  }}
                  style={{ fill: "var(--muted-foreground)" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">{t("allocationDriftNote")}</p>
      </CardContent>
    </Card>
  );
}
