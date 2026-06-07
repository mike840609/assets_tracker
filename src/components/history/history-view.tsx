"use client";

import { useFormatter, useTranslations } from "next-intl";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { cn } from "@/lib/utils";
import { HistoryOnboarding } from "./history-onboarding";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import { DailyChangeChart } from "./daily-change-chart";
import { HistoryHeatmap } from "./history-heatmap";
import { HistorySummary } from "./history-summary";
import { HistoryTable } from "./history-table";

type Props = {
  snapshots: NormalizedSnapshot[];
  baseCurrency: string;
  showTitle?: boolean;
  hideTrendRangeFilter?: boolean;
  className?: string;
  hasAccounts?: boolean;
};

export function HistoryView({
  snapshots,
  baseCurrency,
  showTitle = false,
  hideTrendRangeFilter = false,
  className,
  hasAccounts,
}: Props) {
  const t = useTranslations("history");
  const format = useFormatter();

  const firstSnapshot = snapshots[0];
  const latestSnapshotAt = snapshots.at(-1)?.createdAt ?? null;

  if (snapshots.length === 0) {
    return (
      <div className={cn("space-y-4 md:space-y-8", className)}>
        {showTitle && <LargeTitleHeading>{t("title")}</LargeTitleHeading>}
        <HistoryOnboarding hasAccounts={hasAccounts} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 md:space-y-8", className)}>
      {showTitle && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          {firstSnapshot && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {t("trackingSince", {
                  date: format.dateTime(new Date(firstSnapshot.date + "T00:00:00"), {
                    dateStyle: "medium",
                  }),
                })}
              </span>
              <span aria-hidden="true" className="text-border">
                ·
              </span>
              <span className="tabular-nums">
                {t("snapshotsCount", { count: snapshots.length })}
              </span>
              <FreshnessBadge kind="snapshot" timestamp={latestSnapshotAt} mobileShort />
            </div>
          )}
        </div>
      )}

      {/* Hero row: trend + heatmap hold the width; the rail stacks the derived
          summary over recent daily volatility, mirroring the dashboard's 8/4 split. */}
      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TrendChart
            snapshots={snapshots}
            baseCurrency={baseCurrency}
            hideRangeFilter={hideTrendRangeFilter}
            footer={
              <HistoryHeatmap
                snapshots={snapshots}
                baseCurrency={baseCurrency}
                labels={{ netWorth: t("colNetWorth"), change: t("colChange") }}
              />
            }
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4">
          <HistorySummary snapshots={snapshots} baseCurrency={baseCurrency} />
          <DailyChangeChart snapshots={snapshots} baseCurrency={baseCurrency} className="flex-1" />
        </div>
      </div>

      <HistoryTable snapshots={snapshots} baseCurrency={baseCurrency} />
    </div>
  );
}
