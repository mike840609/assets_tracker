"use client";

import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import { DailyChangeChart } from "./daily-change-chart";
import { HistorySummary } from "./history-summary";
import { HistoryTable } from "./history-table";

type Props = {
  snapshots: NormalizedSnapshot[];
  baseCurrency: string;
  showTitle?: boolean;
  hideTrendRangeFilter?: boolean;
  className?: string;
};

export function HistoryView({
  snapshots,
  baseCurrency,
  showTitle = false,
  hideTrendRangeFilter = false,
  className,
}: Props) {
  const t = useTranslations("history");
  const format = useFormatter();

  const firstSnapshot = snapshots[0];
  const latestSnapshotAt = snapshots.at(-1)?.createdAt ?? null;

  if (snapshots.length === 0) {
    return (
      <div className={cn("space-y-4 md:space-y-8", className)}>
        {showTitle && <LargeTitleHeading>{t("title")}</LargeTitleHeading>}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <LineChart className="size-6 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1.5 text-lg font-semibold text-foreground">{t("emptyTitle")}</h2>
          <p className="mb-6 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("emptyDesc")}
          </p>
          <Link href="/" className={buttonVariants()}>
            {t("emptyCta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
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

      {/* Hero row: the trend line holds the width; the rail stacks the derived
          summary over recent daily volatility, mirroring the dashboard's 8/4 split. */}
      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TrendChart
            snapshots={snapshots}
            baseCurrency={baseCurrency}
            hideRangeFilter={hideTrendRangeFilter}
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
