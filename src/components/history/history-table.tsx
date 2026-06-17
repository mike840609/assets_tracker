"use client";

import { useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { Badge } from "@/components/ui/badge";
import { SnapshotLabelDialog } from "./snapshot-label-dialog";

type SnapshotRow = {
  id: string;
  date: string;
  createdAt: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  label?: string | null;
  note?: string | null;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
};

export function HistoryTable({ snapshots, baseCurrency }: Props) {
  const t = useTranslations("history");
  const format = useFormatter();
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const latestSnapshotAt = snapshots.at(-1)?.createdAt ?? null;

  const monthGroups = useMemo(() => {
    const rows = [...snapshots].reverse().map((snap, idx, arr) => ({
      ...snap,
      change: arr[idx + 1] ? snap.netWorth - arr[idx + 1].netWorth : null,
    }));

    const groups: { monthKey: string; label: string; items: typeof rows }[] = [];
    for (const row of rows) {
      const d = new Date(row.date + "T00:00:00");
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const label = format.dateTime(d, { year: "numeric", month: "long" }).toUpperCase();
      const last = groups[groups.length - 1];
      if (last && last.monthKey === monthKey) {
        last.items.push(row);
      } else {
        groups.push({ monthKey, label, items: [row] });
      }
    }
    return groups;
  }, [snapshots, format]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium">{t("tableTitle")}</h2>
        <FreshnessBadge kind="snapshot" timestamp={latestSnapshotAt} />
      </div>
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
                <div className="hidden md:grid md:grid-cols-[100px_1fr_1fr_120px] md:gap-4 px-4 py-2 bg-muted/30 border-b border-border/40 text-xs font-medium text-muted-foreground">
                  <div>{t("colDate")}</div>
                  <div className="text-right">{t("colAssets")}</div>
                  <div className="text-right">{t("colLiabilities")}</div>
                  <div className="text-right">{`${t("colNetWorth")} / ${t("colChange")}`}</div>
                </div>

                {items.map((row, index) => {
                  const dayLabel = format.dateTime(new Date(row.date + "T00:00:00"), {
                    month: "short",
                    day: "numeric",
                  });
                  const changePositive = row.change !== null && row.change > 0;
                  const changeNegative = row.change !== null && row.change < 0;
                  return (
                    // content-visibility skips layout/paint for rows scrolled out of the
                    // ledger's viewport; the intrinsic-size hint keeps the scrollbar stable.
                    // Heavy users accrue hundreds of daily snapshots, so this bounds paint
                    // cost to the visible window instead of the whole series.
                    <div
                      key={row.id}
                      className="[contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]"
                    >
                      {index > 0 && <div aria-hidden="true" className="h-px bg-border/60 mx-4" />}
                      <div
                        role="row"
                        className={cn(
                          "group/snapshot-row flex flex-col gap-1 px-4 transition-colors hover:bg-muted/30 md:grid md:grid-cols-[100px_1fr_1fr_120px] md:gap-4 md:items-center",
                          isCompact ? "py-2" : "py-3.5",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-3 md:contents">
                          <div role="rowheader" className="min-w-0 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium">{dayLabel}</p>
                              <SnapshotLabelDialog
                                snapshot={row}
                                className={cn(
                                  "-my-1 shrink-0",
                                  row.label
                                    ? "md:text-primary md:opacity-100"
                                    : "md:opacity-0 md:group-hover/snapshot-row:opacity-100 md:focus-visible:opacity-100",
                                )}
                              />
                            </div>
                            {row.label && !privacyMode && (
                              <Badge
                                variant="outline"
                                className="mt-1 max-w-[11rem] justify-start rounded-md px-1.5 text-[10px] md:max-w-[6rem]"
                              >
                                <Tag className="size-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{row.label}</span>
                              </Badge>
                            )}
                          </div>

                          <div
                            role="cell"
                            className="text-right md:order-last md:flex md:flex-col md:justify-center"
                          >
                            <p className="text-sm font-semibold tabular-nums">
                              {privacyMode ? "***" : formatCurrency(row.netWorth, baseCurrency)}
                            </p>
                            <p
                              className={cn(
                                "text-xs tabular-nums mt-0.5",
                                changePositive
                                  ? "text-[var(--gain)]"
                                  : changeNegative
                                    ? "text-[var(--loss)]"
                                    : "text-muted-foreground",
                              )}
                            >
                              {privacyMode ? (
                                "***"
                              ) : row.change === null ? (
                                <>
                                  <span aria-hidden="true">—</span>
                                  <span className="sr-only">{t("noPreviousSnapshot")}</span>
                                </>
                              ) : (
                                (row.change >= 0 ? "+" : "") +
                                formatCurrency(row.change, baseCurrency)
                              )}
                            </p>
                          </div>
                        </div>

                        <div role="cell" className="md:contents">
                          <p className="text-xs text-muted-foreground tabular-nums leading-relaxed md:hidden">
                            {privacyMode ? (
                              "***"
                            ) : (
                              <>
                                <span className="block">
                                  {t("colAssets")} {formatCurrency(row.totalAssets, baseCurrency)}
                                </span>
                                <span className="block">
                                  {t("colLiabilities")}{" "}
                                  {formatCurrency(row.totalLiabilities, baseCurrency)}
                                </span>
                              </>
                            )}
                          </p>
                          {row.note && !privacyMode && (
                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground md:hidden">
                              {row.note}
                            </p>
                          )}
                          <div className="hidden md:block text-right text-sm tabular-nums text-muted-foreground">
                            {privacyMode ? "***" : formatCurrency(row.totalAssets, baseCurrency)}
                          </div>
                          <div className="hidden md:block text-right text-sm tabular-nums text-muted-foreground">
                            {privacyMode
                              ? "***"
                              : formatCurrency(row.totalLiabilities, baseCurrency)}
                          </div>
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
    </div>
  );
}
