"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { MonthlyBucket } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";

interface Props {
  buckets: MonthlyBucket[];
  baseCurrency: string;
  locale: string;
}

interface TooltipPayload {
  payload: MonthlyBucket & { label: string };
}

function ChangeTooltip({
  active,
  payload,
  baseCurrency,
  t,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  baseCurrency: string;
  t: (key: string) => string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  if (b.isEmpty) {
    return (
      <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md">
        <div className="font-medium">{b.label}</div>
        <div className="text-muted-foreground">{t("noDataMonth")}</div>
      </div>
    );
  }
  const pct = b.deltaPct === null ? "—" : `${b.deltaPct >= 0 ? "+" : ""}${b.deltaPct.toFixed(1)}%`;
  const sign = b.deltaNetWorth >= 0 ? "+" : "";
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1">
      <div className="font-medium">{b.label}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("tooltipStart")}</span>
        <span className="tabular-nums">{privacyMode ? "***" : formatCurrency(b.startNetWorth, baseCurrency)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("tooltipEnd")}</span>
        <span className="tabular-nums">{privacyMode ? "***" : formatCurrency(b.endNetWorth, baseCurrency)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border/60 pt-1">
        <span className="text-muted-foreground">{t("tooltipChange")}</span>
        <span
          className={`tabular-nums font-medium ${
            b.deltaNetWorth >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
          }`}
        >
          {privacyMode ? "***" : `${sign}${formatCurrency(b.deltaNetWorth, baseCurrency)} (${pct})`}
        </span>
      </div>
    </div>
  );
}

export function MonthlyChangeChart({ buckets, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = buckets.map((b) => ({ ...b, label: formatMonthLabel(b.monthKey, locale) }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("monthlyChange")}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                width={40}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  Math.abs(v) >= 1000000
                    ? `${(v / 1000000).toFixed(1)}M`
                    : Math.abs(v) >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : String(v)
                }
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                content={<ChangeTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />}
              />
              <Bar dataKey="deltaNetWorth" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.monthKey}
                    fill={
                      entry.isEmpty
                        ? "var(--muted-foreground)"
                        : entry.deltaNetWorth >= 0
                          ? "var(--chart-1)"
                          : "var(--destructive)"
                    }
                    opacity={entry.isEmpty ? 0.3 : 1}
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
