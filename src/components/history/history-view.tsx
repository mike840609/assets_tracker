"use client";

import { useTranslations } from "next-intl";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { cn } from "@/lib/utils";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import { DailyChangeChart } from "./daily-change-chart";
import { HistoryHeatmap } from "./history-heatmap";
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

  return (
    <div className={cn("space-y-4 md:space-y-8", className)}>
      {showTitle && <LargeTitleHeading>{t("title")}</LargeTitleHeading>}

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
      <DailyChangeChart snapshots={snapshots} baseCurrency={baseCurrency} />
      <HistoryTable snapshots={snapshots} baseCurrency={baseCurrency} />
    </div>
  );
}
