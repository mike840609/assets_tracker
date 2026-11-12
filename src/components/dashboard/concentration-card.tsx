"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { computeConcentration } from "@/lib/services/analysis-service";
import type { NetWorthSummary } from "@/lib/types";

export function ConcentrationCard({ summary }: { summary: NetWorthSummary }) {
  const t = useTranslations("concentration");
  const { privacyMode } = usePrivacyMode();
  const { top, hhi } = useMemo(() => computeConcentration(summary), [summary]);

  if (top.length === 0) return null;

  const level = hhi >= 0.25 ? "high" : hhi >= 0.15 ? "moderate" : "low";

  return (
    <div data-testid="portfolio-concentration-row">
      <Card className="flex flex-col">
        {/* The top list already leads with the largest position, so no separate headline figure. */}
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            {t(`level_${level}` as "level_low" | "level_moderate" | "level_high")}
          </span>
        </CardHeader>
        <CardContent className="flex-1">
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {top.map((position) => (
              <li key={position.label} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-foreground">{position.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {privacyMode ? "***" : `${position.pct.toFixed(1)}%`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, position.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
