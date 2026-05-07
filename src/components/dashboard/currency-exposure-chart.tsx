"use client";

import { useState, useEffect, useMemo, useCallback, startTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector, Label } from "recharts";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { NetWorthSummary } from "@/lib/types";

const COLORS = [
  "oklch(0.65 0.18 270)", // Indigo
  "oklch(0.72 0.17 310)", // Fuchsia
  "oklch(0.78 0.16 65)", // Amber
  "oklch(0.72 0.19 155)", // Emerald
  "oklch(0.70 0.15 220)", // Sky blue
  "oklch(0.68 0.14 25)", // Coral
  "oklch(0.75 0.12 180)", // Teal
  "oklch(0.60 0.16 330)", // Rose
  "oklch(0.80 0.14 100)", // Lime
];

export function CurrencyExposureChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const t = useTranslations("currencyExposure");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const data = useMemo(() => {
    const total = summary.currencyExposure.reduce((acc, curr) => acc + curr.value, 0);
    return summary.currencyExposure
      .map((exposure) => ({
        name: exposure.currency,
        value: Math.round(exposure.value * 100) / 100,
        percentage: total > 0 ? ((exposure.value / total) * 100).toFixed(1) : "0",
      }))
      .filter((d) => d.value > 0);
  }, [summary.currencyExposure]);

  const handleMouseEnter = useCallback((_: unknown, index: number) => setActiveIndex(index), []);
  const handleMouseLeave = useCallback(() => setActiveIndex(-1), []);

  /* Custom shape function that expands the hovered slice */
  const renderShape = useCallback(
    (props: {
      cx: number;
      cy: number;
      innerRadius: number;
      outerRadius: number;
      startAngle: number;
      endAngle: number;
      fill?: string;
      index: number;
    }) => {
      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props;
      const isActive = index === activeIndex;
      return (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={isActive ? innerRadius - 3 : innerRadius}
          outerRadius={isActive ? outerRadius + 8 : outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          cornerRadius={4}
          style={{
            filter: isActive ? "drop-shadow(0px 6px 12px rgba(0,0,0,0.25))" : "none",
            transition: "all 200ms ease-out",
            outline: "none",
            cursor: "pointer",
          }}
        />
      );
    },
    [activeIndex],
  );

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-1 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-3">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noExposure")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            {/* Chart on top, Legend below */}
            <div className="flex flex-col items-center">
              {/* Donut chart */}
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {COLORS.map((color, index) => (
                        <linearGradient
                          key={`grad-${index}`}
                          id={`expo-grad-${index}`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.65} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                      isAnimationActive={isAnimationActive}
                      onAnimationEnd={onAnimationEnd}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      stroke="none"
                      shape={renderShape}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            const activeItem = activeIndex >= 0 ? data[activeIndex] : null;
                            const displayPct = activeItem ? `${activeItem.percentage}%` : "100%";
                            const displayLabel = activeItem ? activeItem.name : t("total");

                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) - 6}
                                  className="fill-foreground font-bold"
                                  style={{ fontSize: "16px" }}
                                >
                                  {displayPct}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 12}
                                  className="fill-muted-foreground"
                                  style={{ fontSize: "10px" }}
                                >
                                  {displayLabel.length > 10
                                    ? displayLabel.slice(0, 10) + "…"
                                    : displayLabel}
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                      {data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#expo-grad-${index % COLORS.length})`}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Custom legend below */}
              <div className="w-full space-y-1 pt-1">
                {data.map((item, index) => {
                  const isActive = activeIndex === index;
                  return (
                    <div
                      key={item.name}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ${
                        isActive ? "bg-accent/80 shadow-sm scale-[1.01]" : "hover:bg-accent/50"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(-1)}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200 ${isActive ? "scale-125" : ""}`}
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-foreground font-medium truncate flex-1 min-w-0">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs tabular-nums text-muted-foreground font-medium">
                          {privacyMode ? "••••" : formatCurrency(item.value, summary.baseCurrency)}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full transition-colors duration-200 ${
                            isActive
                              ? "bg-foreground/10 text-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
