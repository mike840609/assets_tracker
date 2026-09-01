"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Sector, Label } from "recharts";
import { useContainerWidth } from "@/hooks/use-container-size";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { formatCurrency } from "@/lib/currencies";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { NetWorthSummary } from "@/lib/types";

// Schema-aware spectrum: --chart-1..5 re-tint with the selected color schema
// (chart-1 is the accent), --chart-6..9 stay as the supplementary spectrum.
const COLORS = [
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

export function AllocationChart({ summary }: { summary: NetWorthSummary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const { density } = useDensity();
  const isCompact = density === "compact";

  const data = useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const account of summary.accounts) {
      if (account.type !== "ASSET") continue;
      const cat = account.category;
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + account.totalValueInBaseCurrency);
    }
    const total = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
    return Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        name: t(`categories.${category}`, { defaultValue: category }),
        value: Math.round(value * 100) / 100,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [summary.accounts, t]);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

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
    <Card>
      <CardHeader className="pb-1 px-4">
        <CardTitle className="text-foreground">{t("allocationChart.title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("allocationChart.noAssets")}
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            {/* Chart on top, Legend below */}
            <div className="flex flex-col items-center">
              {/* Donut chart */}
              <div className="w-full h-[180px]">
                {containerWidth > 0 && (
                  <PieChart width={containerWidth} height={180}>
                    <defs>
                      {COLORS.map((color, index) => (
                        <linearGradient
                          key={`grad-${index}`}
                          id={`alloc-grad-${index}`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          {/* var() resolves in the CSS `stop-color` property (style),
                              not in the SVG presentation attribute. */}
                          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.95 }} />
                          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.65 }} />
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
                      onTouchStart={handleMouseEnter}
                      onTouchEnd={handleMouseLeave}
                      stroke="none"
                      shape={renderShape}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            const activeItem = activeIndex >= 0 ? data[activeIndex] : null;
                            const displayPct = activeItem
                              ? `${activeItem.percentage}%`
                              : privacyMode
                                ? "••••"
                                : formatCurrency(total, summary.baseCurrency, true);
                            const displayLabel = activeItem
                              ? activeItem.name
                              : t("allocationChart.total");

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
                          fill={`url(#alloc-grad-${index % COLORS.length})`}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </div>

              {/* Custom legend below */}
              <div className="w-full space-y-1 pt-1">
                {data.map((item, index) => {
                  const isActive = activeIndex === index;
                  return (
                    <div
                      key={item.name}
                      className={`group flex items-center gap-2 ${isCompact ? "px-2 py-1" : "px-2.5 py-1.5"} rounded-lg cursor-pointer transition-all duration-200 ${
                        isActive ? "bg-accent/80 shadow-sm scale-[1.01]" : "hover:bg-accent/50"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(-1)}
                      onTouchStart={() => setActiveIndex(index)}
                      onTouchEnd={() => setActiveIndex(-1)}
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
