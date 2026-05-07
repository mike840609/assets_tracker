"use client";

import { useEffect, useState, startTransition } from "react";
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
import type { CashFlowBucket } from "@/lib/services/analysis-service";

interface Props {
  buckets: CashFlowBucket[];
  baseCurrency: string;
}

interface TooltipPayload {
  payload: CashFlowBucket;
  dataKey: string;
  value: number;
  color: string;
}

function CashFlowTooltip({
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

  const contribSign = b.contributions >= 0 ? "+" : "";
  const marketSign = b.marketPerformance >= 0 ? "+" : "";

  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1">
      <div className="font-medium">{b.label}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("seriesContributions")}</span>
        <span className="tabular-nums">
          {privacyMode ? "***" : `${contribSign}${formatCurrency(b.contributions, baseCurrency)}`}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("seriesMarket")}</span>
        <span
          className={`tabular-nums ${
            b.marketPerformance >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
          }`}
        >
          {privacyMode
            ? "***"
            : `${marketSign}${formatCurrency(b.marketPerformance, baseCurrency)}`}
        </span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border/60 pt-1">
        <span className="text-muted-foreground">{t("tooltipChange")}</span>
        <span
          className={`tabular-nums font-medium ${
            b.deltaNetWorth >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
          }`}
        >
          {privacyMode ? (
            "***"
          ) : (
            <>
              {b.deltaNetWorth >= 0 ? "+" : ""}
              {formatCurrency(b.deltaNetWorth, baseCurrency)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

const tickFormatter = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : String(v);

export function CashFlowChart({ buckets, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("cashFlow")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("cashFlowSubtitle")}</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {buckets.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={buckets} margin={{ top: 10, right: 4, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  width={50}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (privacyMode ? "" : tickFormatter(v))}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  content={
                    <CashFlowTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />
                  }
                />
                {/* Contributions bar */}
                <Bar
                  dataKey="contributions"
                  name={t("seriesContributions")}
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                >
                  {buckets.map((b) => (
                    <Cell
                      key={`contrib-${b.monthKey}`}
                      fill="var(--chart-2)"
                      opacity={b.isEmpty ? 0.2 : 0.85}
                    />
                  ))}
                </Bar>
                {/* Market performance bar */}
                <Bar
                  dataKey="marketPerformance"
                  name={t("seriesMarket")}
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                >
                  {buckets.map((b) => (
                    <Cell
                      key={`market-${b.monthKey}`}
                      fill={
                        b.isEmpty
                          ? "var(--muted-foreground)"
                          : b.marketPerformance >= 0
                            ? "var(--chart-1)"
                            : "var(--destructive)"
                      }
                      opacity={b.isEmpty ? 0.2 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("cashFlowNote")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
