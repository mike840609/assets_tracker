"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { formatCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import { ActiveDayBoundary } from "./active-day-context";
import { HistoryOnboarding } from "./history-onboarding";
import type {
  NormalizedSnapshot,
  SnapshotReconciliationWarning,
} from "@/lib/services/history-service";
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
  reconciliationWarning?: SnapshotReconciliationWarning | null;
  /** True when some snapshots were recorded in a different base currency. */
  hasConvertedSnapshots?: boolean;
};

export function HistoryView({
  snapshots,
  baseCurrency,
  showTitle = false,
  hideTrendRangeFilter = false,
  className,
  hasAccounts,
  reconciliationWarning = null,
  hasConvertedSnapshots = false,
}: Props) {
  const t = useTranslations("history");
  const format = useFormatter();
  const { privacyMode } = usePrivacyMode();

  const firstSnapshot = snapshots[0];
  const latestSnapshotAt = snapshots.at(-1)?.createdAt ?? null;
  const driftPercent = reconciliationWarning
    ? `${(reconciliationWarning.differencePercent * 100).toFixed(1)}%`
    : null;
  const driftAmount =
    reconciliationWarning && !privacyMode
      ? formatCurrency(
          Math.abs(reconciliationWarning.difference),
          reconciliationWarning.baseCurrency,
          true,
        )
      : null;

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
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
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

      {reconciliationWarning && driftPercent && (
        <div
          role="status"
          className="flex gap-3 rounded-lg border border-[var(--warning)]/30 bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground">{t("reconciliation.title")}</p>
            <p className="text-muted-foreground">
              {privacyMode || !driftAmount
                ? t("reconciliation.descriptionPrivate", { percent: driftPercent })
                : t("reconciliation.description", {
                    amount: driftAmount,
                    percent: driftPercent,
                  })}
            </p>
          </div>
        </div>
      )}

      {hasConvertedSnapshots && (
        <p className="text-xs text-muted-foreground">{t("convertedNote")}</p>
      )}

      {/* Hero row: trend + heatmap hold the width; the rail stacks the derived
          summary over recent daily volatility, mirroring the dashboard's 8/4 split. */}
      <ActiveDayBoundary>
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
            <DailyChangeChart
              snapshots={snapshots}
              baseCurrency={baseCurrency}
              className="flex-1"
            />
          </div>
        </div>
      </ActiveDayBoundary>

      <HistoryTable snapshots={snapshots} baseCurrency={baseCurrency} />
    </div>
  );
}
