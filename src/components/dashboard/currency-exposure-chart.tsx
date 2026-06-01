"use client";

import { useState, useMemo, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import type { NetWorthSummary } from "@/lib/types";

// Schema-aware spectrum (see allocation-chart). Rotated to start at --chart-3
// so this module stays visually distinct from the allocation donut beside it.
const COLORS = [
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
];

export function CurrencyExposureChart({ summary }: { summary: NetWorthSummary }) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const t = useTranslations("currencyExposure");
  const { privacyMode } = usePrivacyMode();
  const reduceMotion = useReducedMotion();

  // Wipe the proportion bar in from the left once after mount (a horizontal
  // reveal, distinct from the allocation donut's radial sweep). Reduced motion
  // lands at full width immediately.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const data = useMemo(() => {
    const total = summary.currencyExposure.reduce((acc, curr) => acc + curr.value, 0);
    return summary.currencyExposure
      .map((exposure) => ({
        name: exposure.currency,
        value: Math.round(exposure.value * 100) / 100,
        percentage: total > 0 ? ((exposure.value / total) * 100).toFixed(1) : "0",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [summary.currencyExposure]);

  return (
    <Card>
      <CardHeader className="pb-1 px-4">
        <CardTitle asChild className="text-foreground">
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noExposure")}
          </div>
        ) : (
          <div
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            {/* Proportion bar — segments sized by share, hover-linked to the list */}
            <div
              className="flex w-full h-3 gap-0.5 overflow-hidden rounded-full bg-muted/40 ring-1 ring-inset ring-foreground/5"
              style={{
                transform: reduceMotion || grown ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: reduceMotion ? "none" : "transform 600ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {data.map((item, index) => {
                const dimmed = activeIndex !== -1 && activeIndex !== index;
                return (
                  <button
                    key={item.name}
                    type="button"
                    aria-label={`${item.name} ${item.percentage}%`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(-1)}
                    onTouchStart={() => setActiveIndex(index)}
                    onTouchEnd={() => setActiveIndex(-1)}
                    className="h-full min-w-[3px] cursor-pointer transition-opacity duration-200 first:rounded-l-full last:rounded-r-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{
                      flexGrow: item.value,
                      flexBasis: 0,
                      background: COLORS[index % COLORS.length],
                      opacity: dimmed ? 0.35 : 1,
                    }}
                  />
                );
              })}
            </div>

            {/* Ranked list */}
            <div className="w-full space-y-1 pt-3">
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
        )}
      </CardContent>
    </Card>
  );
}
