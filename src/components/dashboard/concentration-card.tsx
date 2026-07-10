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
  const { top, topHoldingPct, hhi } = useMemo(() => computeConcentration(summary), [summary]);

  if (top.length === 0) return null;

  const level = hhi >= 0.25 ? "high" : hhi >= 0.15 ? "moderate" : "low";

  return (
    <div data-testid="portfolio-concentration-row">
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent className="grid flex-1 gap-4 lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)] lg:gap-6">
          <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-3">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">
                {privacyMode ? "***" : `${topHoldingPct.toFixed(1)}%`}
              </div>
              <div className="text-[11px] text-muted-foreground">{t("largestPosition")}</div>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {t(`level_${level}` as "level_low" | "level_moderate" | "level_high")}
            </span>
          </div>
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
