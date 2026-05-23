"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { FreshnessBadge } from "@/components/ui/freshness-badge";

type SnapshotRow = {
  id: string;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
};

export function HistoryTable({ snapshots, baseCurrency }: Props) {
  const t = useTranslations("history");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const latestSnapshotAt = snapshots.length > 0 ? snapshots[snapshots.length - 1]!.date : null;

  const monthGroups = useMemo(() => {
    const rows = [...snapshots].reverse().map((snap, idx, arr) => ({
      ...snap,
      change: arr[idx + 1] ? snap.netWorth - arr[idx + 1].netWorth : null,
    }));

    const groups: { monthKey: string; label: string; items: typeof rows }[] = [];
    for (const row of rows) {
      const d = new Date(row.date + "T00:00:00");
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d
        .toLocaleDateString(undefined, { year: "numeric", month: "long" })
        .toUpperCase();
      const last = groups[groups.length - 1];
      if (last && last.monthKey === monthKey) {
        last.items.push(row);
      } else {
        groups.push({ monthKey, label, items: [row] });
      }
    }
    return groups;
  }, [snapshots]);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
        <FreshnessBadge kind="snapshot" timestamp={latestSnapshotAt} />
      </CardHeader>
      <CardContent>
        {monthGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{t("noData")}</div>
        ) : (
          <div
            role="table"
            aria-label={t("title")}
            tabIndex={0}
            className="max-h-[min(480px,55vh)] overflow-y-auto space-y-4 pr-1"
          >
            <div role="rowgroup" className="sr-only">
              <div role="row">
                <span role="columnheader">{t("colDate")}</span>
                <span role="columnheader">{`${t("colAssets")} / ${t("colLiabilities")}`}</span>
                <span role="columnheader">{`${t("colNetWorth")} / ${t("colChange")}`}</span>
              </div>
            </div>

            {monthGroups.map(({ monthKey, label, items }) => (
              <div key={monthKey} role="rowgroup">
                <div
                  role="row"
                  className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm mb-2 px-1 py-1"
                >
                  <span
                    role="columnheader"
                    aria-colspan={3}
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70"
                  >
                    {label}
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
                  {items.map((row, index) => {
                    const dayLabel = new Date(row.date + "T00:00:00").toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                      },
                    );
                    const changePositive = row.change !== null && row.change > 0;
                    const changeNegative = row.change !== null && row.change < 0;
                    return (
                      <div key={row.id}>
                        {index > 0 && <div aria-hidden="true" className="h-px bg-border/60 mx-4" />}
                        <div
                          role="row"
                          className={`flex items-center gap-3 px-4 ${isCompact ? "py-2" : "py-3.5"}`}
                        >
                          <div role="rowheader" className="min-w-[4rem] shrink-0">
                            <p className="text-sm font-medium">{dayLabel}</p>
                          </div>
                          <div role="cell" className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground tabular-nums leading-relaxed">
                              {privacyMode ? (
                                "***"
                              ) : (
                                <>
                                  <span className="block truncate">
                                    {t("colAssets")} {formatCurrency(row.totalAssets, baseCurrency)}
                                  </span>
                                  <span className="block truncate">
                                    {t("colLiabilities")}{" "}
                                    {formatCurrency(row.totalLiabilities, baseCurrency)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <div role="cell" className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              {privacyMode ? "***" : formatCurrency(row.netWorth, baseCurrency)}
                            </p>
                            <p
                              className={cn(
                                "text-xs tabular-nums mt-0.5",
                                changePositive
                                  ? "text-primary"
                                  : changeNegative
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                              )}
                            >
                              {privacyMode ? (
                                "***"
                              ) : row.change === null ? (
                                <span
                                  title={t("noPreviousSnapshot")}
                                  aria-label={t("noPreviousSnapshot")}
                                  className="cursor-help"
                                >
                                  —
                                </span>
                              ) : (
                                (row.change >= 0 ? "+" : "") +
                                formatCurrency(row.change, baseCurrency)
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
