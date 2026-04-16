"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import {
  aggregateMonthlyChange,
  computeKpis,
  fillMonthRange,
} from "@/lib/services/analysis-service";
import { MonthlyChangeChart } from "./monthly-change-chart";
import { AssetsLiabilitiesChart } from "./assets-liabilities-chart";
import { KpiTiles } from "./kpi-tiles";

interface Props {
  snapshots: NormalizedSnapshot[];
  baseCurrency: string;
  locale: string;
}

const ranges = [
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "All", months: Infinity },
] as const;

type RangeLabel = (typeof ranges)[number]["label"];

function rangeCutoff(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  // Start from the first day of that month so we don't truncate its snapshots.
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function AnalysisView({ snapshots, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const [range, setRange] = useState<RangeLabel>("1Y");

  const rangeLabelKey: Record<RangeLabel, string> = {
    "6M": "range6M",
    "1Y": "range1Y",
    "2Y": "range2Y",
    All: "rangeAll",
  };

  const { filteredSnapshots, rangeStart, rangeEnd } = useMemo(() => {
    const selected = ranges.find((r) => r.label === range)!;
    const now = new Date();
    const rangeEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    if (selected.months === Infinity) {
      const firstDate = snapshots.length > 0 ? new Date(snapshots[0].date) : now;
      const rangeStart = new Date(Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), 1));
      return { filteredSnapshots: snapshots, rangeStart, rangeEnd };
    }
    const cutoff = rangeCutoff(selected.months);
    const cutoffIso = cutoff.toISOString().split("T")[0];
    const rangeStart = new Date(Date.UTC(cutoff.getFullYear(), cutoff.getMonth(), 1));
    return {
      filteredSnapshots: snapshots.filter((s) => s.date >= cutoffIso),
      rangeStart,
      rangeEnd,
    };
  }, [snapshots, range]);

  const buckets = useMemo(() => {
    const real = aggregateMonthlyChange(filteredSnapshots);
    return fillMonthRange(real, rangeStart, rangeEnd);
  }, [filteredSnapshots, rangeStart, rangeEnd]);

  // KPIs use the full series so YTD can reach into prior-year data even when
  // the user has zoomed into a 6M view.
  const kpis = useMemo(
    () => computeKpis(buckets, snapshots),
    [buckets, snapshots]
  );

  const hasData = snapshots.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.label)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                range === r.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(rangeLabelKey[r.label])}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("noData")}
        </div>
      ) : (
        <>
          <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
          <MonthlyChangeChart
            buckets={buckets}
            baseCurrency={baseCurrency}
            locale={locale}
          />
          <AssetsLiabilitiesChart
            buckets={buckets}
            baseCurrency={baseCurrency}
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
