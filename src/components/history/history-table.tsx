"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

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

  const monthGroups = useMemo(() => {
    const rows = [...snapshots].reverse().map((snap, idx, arr) => ({
      ...snap,
      change: arr[idx + 1] ? snap.netWorth - arr[idx + 1].netWorth : null,
    }));

    const groups: { monthKey: string; label: string; items: typeof rows }[] = [];
    for (const row of rows) {
      const d = new Date(row.date + "T00:00:00");
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(undefined, { year: "numeric", month: "long" }).toUpperCase();
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {monthGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto space-y-4 pr-1">
            {monthGroups.map(({ monthKey, label, items }) => (
              <div key={monthKey}>
                <p className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1 py-1">
                  {label}
                </p>
                <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
                  {items.map((row, index) => {
                    const dayLabel = new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short", day: "numeric",
                    });
                    const changePositive = row.change !== null && row.change > 0;
                    const changeNegative = row.change !== null && row.change < 0;
                    return (
                      <div key={row.id}>
                        {index > 0 && <div className="h-px bg-border/60 mx-4" />}
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <div className="w-16 shrink-0">
                            <p className="text-sm font-medium">{dayLabel}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {privacyMode ? "***" : (
                                <>
                                  {t("colAssets")} {formatCurrency(row.totalAssets, baseCurrency)}
                                  {" · "}
                                  {t("colLiabilities")} {formatCurrency(row.totalLiabilities, baseCurrency)}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              {privacyMode ? "***" : formatCurrency(row.netWorth, baseCurrency)}
                            </p>
                            <p className={cn(
                              "text-xs tabular-nums mt-0.5",
                              changePositive ? "text-emerald-600 dark:text-emerald-400" :
                              changeNegative ? "text-red-500 dark:text-red-400" :
                              "text-muted-foreground"
                            )}>
                              {privacyMode ? "***" : row.change === null
                                ? "—"
                                : (row.change >= 0 ? "+" : "") + formatCurrency(row.change, baseCurrency)}
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
