"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { PieChart, Pie, Cell, Sector, Label } from "recharts";
import { useContainerWidth } from "@/hooks/use-container-size";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { NetWorthSummary } from "@/lib/types";

/**
 * Chart palette pulls from --chart-1 … --chart-5 so the active color schema
 * reaches the donut. Five-color rotation; users rarely hold more than ~5 currencies.
 */
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function CurrencyExposureChart({ summary }: { summary: NetWorthSummary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const t = useTranslations("currencyExposure");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();

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

  // Keep activeIndex in a ref so renderShape can stay stable across renders.
  // If renderShape's reference changes, Recharts treats it as a new shape prop
  // and remounts the sectors — new mounts can't transition from prior state,
  // so only the first hover animates and subsequent hovers snap.
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

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
      const isActive = index === activeIndexRef.current;
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
            filter: isActive ? "drop-shadow(var(--shadow-pop))" : "none",
            transition: "all 200ms ease-out",
            outline: "none",
            cursor: "pointer",
          }}
        />
      );
    },
    [],
  );

  return (
    <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5">
      <header className="pb-3">
        <h3 className="text-base font-medium text-foreground">{t("title")}</h3>
      </header>
      <div>
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noExposure")}
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            {/* Chart on top, Legend below */}
            <div className="flex flex-col items-center">
              {/* Donut chart — decorative; the legend below is the accessible surface */}
              <div className="w-full h-[180px]" role="presentation">
                {containerWidth > 0 && (
                  <PieChart width={containerWidth} height={180}>
                    <defs>
                      {PALETTE.map((_, index) => (
                        <linearGradient
                          key={`grad-${index}`}
                          id={`expo-grad-${index}`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" className={`chart-stop-${index}`} stopOpacity={0.95} />
                          <stop
                            offset="100%"
                            className={`chart-stop-${index}`}
                            stopOpacity={0.65}
                          />
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
                          fill={`url(#expo-grad-${index % PALETTE.length})`}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </div>

              {/* Legend — the accessible control surface for the donut */}
              <ul className="w-full space-y-1 pt-1 list-none pl-0">
                {data.map((item, index) => {
                  const isActive = activeIndex === index;
                  return (
                    <li key={item.name}>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex((c) => (c === index ? -1 : c))}
                        onFocus={() => setActiveIndex(index)}
                        onBlur={() => setActiveIndex((c) => (c === index ? -1 : c))}
                        className={`group flex w-full items-center gap-2 px-2.5 py-1.5 pointer-coarse:min-h-[44px] rounded-lg text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                          isActive ? "bg-accent/80 shadow-sm scale-[1.01]" : "hover:bg-accent/50"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200 ${isActive ? "scale-125" : ""}`}
                          style={{ background: PALETTE[index % PALETTE.length] }}
                        />
                        <span className="text-sm text-foreground font-medium truncate flex-1 min-w-0">
                          {item.name}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs tabular-nums text-muted-foreground font-medium">
                            {privacyMode
                              ? "••••"
                              : formatCurrency(item.value, summary.baseCurrency)}
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
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
