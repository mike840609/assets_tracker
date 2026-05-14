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
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import type { BenchmarkPoint } from "@/lib/services/analysis-service";
import type { IndexHistory } from "@/lib/services/benchmark-service";

const INDEX_COLORS: Record<string, string> = {
  "^GSPC": "#3b82f6", // blue
  "^IXIC": "#f59e0b", // amber
  "^RUT": "#8b5cf6", // violet
};

interface TooltipPayload {
  dataKey: string;
  value: number | null;
  color: string;
  name: string;
}

function BenchmarkTooltip({
  active,
  payload,
  label,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p) => p.value != null);
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1 max-w-[200px]">
      <div className="font-medium">{label}</div>
      {visible.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="tabular-nums font-medium">
            {privacyMode ? "***" : `${p.value! >= 0 ? "+" : ""}${p.value!.toFixed(2)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

const tickFormatter = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;

interface Props {
  data: BenchmarkPoint[];
  indexHistory: IndexHistory[];
}

type IndexSymbol = "^GSPC" | "^IXIC" | "^RUT";

const INDEX_ORDER: IndexSymbol[] = ["^GSPC", "^IXIC", "^RUT"];

export function BenchmarkComparisonChart({ data, indexHistory }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();

  // S&P 500 on by default; others toggled by user
  const [enabled, setEnabled] = useState<Record<IndexSymbol, boolean>>({
    "^GSPC": true,
    "^IXIC": false,
    "^RUT": false,
  });

  useEffect(() => startTransition(() => setMounted(true)), []);

  const toggle = (sym: IndexSymbol) =>
    setEnabled((prev: Record<IndexSymbol, boolean>) => ({ ...prev, [sym]: !prev[sym] }));

  // Build a label map from IndexHistory
  const labelOf = (sym: string) => indexHistory.find((i) => i.symbol === sym)?.label ?? sym;

  // Only include indices that have data
  const availableSymbols = INDEX_ORDER.filter((sym) =>
    indexHistory.some((i) => i.symbol === sym && i.data.length > 0),
  );

  const hasData = data.some(
    (d) => d.netWorth != null || availableSymbols.some((sym) => d[sym] != null),
  );

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium text-foreground">
              {t("benchmarkTitle")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t("benchmarkSubtitle")}</p>
          </div>
          {availableSymbols.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableSymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => toggle(sym)}
                  aria-pressed={enabled[sym]}
                  className={`px-2 py-1 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    enabled[sym] ? "text-white" : "text-muted-foreground hover:bg-muted"
                  }`}
                  style={enabled[sym] ? { backgroundColor: INDEX_COLORS[sym] } : undefined}
                >
                  {labelOf(sym)}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {!hasData ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("benchmarkNoData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={data}
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
                  width={54}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => (privacyMode ? "" : tickFormatter(v))}
                />
                <Tooltip content={<BenchmarkTooltip privacyMode={privacyMode} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {/* Net worth line — always visible */}
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  name={t("benchmarkNetWorth")}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
                {/* Index lines — toggled by user */}
                {availableSymbols
                  .filter((sym) => enabled[sym])
                  .map((sym) => (
                    <Line
                      key={sym}
                      type="monotone"
                      dataKey={sym}
                      name={labelOf(sym)}
                      stroke={INDEX_COLORS[sym]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
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
