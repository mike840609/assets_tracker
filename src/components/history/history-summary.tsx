"use client";

import { useMemo, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import type { NormalizedSnapshot } from "@/lib/services/history-service";

type Props = {
  snapshots: NormalizedSnapshot[];
  baseCurrency: string;
  className?: string;
};

type DayMove = { value: number; date: string };

/**
 * Summary rail for the desktop History page. Condenses the full snapshot
 * series into a compact stat grid that answers "what changed / am I on
 * track": the all-time range, the move since start and over the last 30
 * days, the current drawdown, the single best/worst days, and how
 * consistently net worth has risen. Sits beside the trend chart.
 *
 * Figures use compact currency (NT$27.3M) to stay scannable in the rail;
 * the precise amounts live in the ledger below. Privacy mode masks
 * absolute money but keeps percentages and counts, so the shape of
 * performance stays legible without exposing wealth.
 */
export function HistorySummary({ snapshots, baseCurrency, className }: Props) {
  const t = useTranslations("history");
  const format = useFormatter();
  const { privacyMode } = usePrivacyMode();

  const stats = useMemo(() => {
    if (snapshots.length === 0) return null;

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    let athValue = first.netWorth;
    let athDate = first.date;
    let atlValue = first.netWorth;
    let atlDate = first.date;
    for (const snap of snapshots) {
      if (snap.netWorth > athValue) {
        athValue = snap.netWorth;
        athDate = snap.date;
      }
      if (snap.netWorth < atlValue) {
        atlValue = snap.netWorth;
        atlDate = snap.date;
      }
    }

    const changeAbs = last.netWorth - first.netWorth;
    const changePct = first.netWorth !== 0 ? (changeAbs / Math.abs(first.netWorth)) * 100 : null;

    const drawdownAbs = last.netWorth - athValue;
    const atHigh = drawdownAbs >= 0;
    const drawdownPct = athValue > 0 ? (drawdownAbs / athValue) * 100 : null;

    // Last 30 days: compare against the latest snapshot on or before (lastDate - 30d).
    const cutoff = new Date(last.date + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(cutoff.getDate()).padStart(2, "0")}`;
    let baseline30: NormalizedSnapshot | null = null;
    for (const snap of snapshots) {
      if (snap.date <= cutoffStr) baseline30 = snap;
      else break;
    }
    const recent30Abs = baseline30 ? last.netWorth - baseline30.netWorth : null;
    const recent30Pct =
      baseline30 && baseline30.netWorth !== 0
        ? ((last.netWorth - baseline30.netWorth) / Math.abs(baseline30.netWorth)) * 100
        : null;

    // Single best / worst inter-snapshot moves, and the up vs down tally.
    let best: DayMove | null = null;
    let worst: DayMove | null = null;
    let upDays = 0;
    let downDays = 0;
    for (let i = 1; i < snapshots.length; i++) {
      const delta = snapshots[i].netWorth - snapshots[i - 1].netWorth;
      if (delta > 0) upDays++;
      else if (delta < 0) downDays++;
      if (best === null || delta > best.value) best = { value: delta, date: snapshots[i].date };
      if (worst === null || delta < worst.value) worst = { value: delta, date: snapshots[i].date };
    }
    // Only surface best/worst when they actually represent gains/losses.
    const bestGain: DayMove | null = best && best.value > 0 ? best : null;
    const worstLoss: DayMove | null = worst && worst.value < 0 ? worst : null;

    return {
      current: last.netWorth,
      athValue,
      athDate,
      atlValue,
      atlDate,
      changeAbs,
      changePct,
      recent30Abs,
      recent30Pct,
      drawdownAbs,
      drawdownPct,
      atHigh,
      best: bestGain,
      worst: worstLoss,
      upDays,
      downDays,
      hasSpan: snapshots.length >= 2,
    };
  }, [snapshots]);

  if (!stats) return null;

  const money = (value: number) =>
    privacyMode ? "***" : formatCurrency(value, baseCurrency, true);
  const signedMoney = (value: number) =>
    privacyMode ? "***" : `${value >= 0 ? "+" : ""}${formatCurrency(value, baseCurrency, true)}`;
  const signedPct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const shortDate = (dateStr: string) =>
    format.dateTime(new Date(dateStr + "T00:00:00"), { month: "short", day: "numeric" });

  const tone = (value: number) =>
    value > 0 ? "text-[var(--gain)]" : value < 0 ? "text-[var(--loss)]" : "text-foreground";

  return (
    <Card className={cn(className)}>
      <CardHeader className="px-4 pb-3">
        <CardTitle className="text-base font-medium text-foreground">{t("summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Lead block: the one number that answers "where do I stand", with the
            drawdown from peak as its supporting line. Everything below is demoted. */}
        <div className="flex flex-col gap-0.5 pb-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("current")}
          </span>
          <span className="text-2xl font-semibold leading-none tabular-nums text-foreground">
            {money(stats.current)}
          </span>
          <span
            className={cn(
              "mt-1 text-xs tabular-nums",
              stats.atHigh ? "text-[var(--gain)]" : "text-[var(--loss)]",
            )}
          >
            {stats.atHigh
              ? t("atHigh")
              : `${t("fromHigh")} ${
                  stats.drawdownPct !== null
                    ? signedPct(stats.drawdownPct)
                    : signedMoney(stats.drawdownAbs)
                }`}
          </span>
        </div>

        <div className="h-px bg-border/60" aria-hidden="true" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
          <Stat
            label={t("sinceFirst")}
            value={stats.hasSpan ? signedMoney(stats.changeAbs) : "—"}
            valueClass={stats.hasSpan ? tone(stats.changeAbs) : "text-muted-foreground"}
            sub={stats.hasSpan && stats.changePct !== null ? signedPct(stats.changePct) : undefined}
            subClass={tone(stats.changeAbs)}
          />
          <Stat
            label={t("last30Days")}
            value={stats.recent30Abs !== null ? signedMoney(stats.recent30Abs) : "—"}
            valueClass={
              stats.recent30Abs !== null ? tone(stats.recent30Abs) : "text-muted-foreground"
            }
            sub={stats.recent30Pct !== null ? signedPct(stats.recent30Pct) : undefined}
            subClass={stats.recent30Abs !== null ? tone(stats.recent30Abs) : undefined}
          />

          <Stat
            label={t("allTimeHigh")}
            value={money(stats.athValue)}
            sub={shortDate(stats.athDate)}
          />
          <Stat
            label={t("allTimeLow")}
            value={money(stats.atlValue)}
            sub={shortDate(stats.atlDate)}
          />

          <Stat
            label={t("bestDay")}
            value={stats.best ? signedMoney(stats.best.value) : "—"}
            valueClass={stats.best ? "text-[var(--gain)]" : "text-muted-foreground"}
            sub={stats.best ? shortDate(stats.best.date) : undefined}
          />
          <Stat
            label={t("worstDay")}
            value={stats.worst ? signedMoney(stats.worst.value) : "—"}
            valueClass={stats.worst ? "text-[var(--loss)]" : "text-muted-foreground"}
            sub={stats.worst ? shortDate(stats.worst.date) : undefined}
          />

          <Stat
            className="col-span-2"
            label={t("upDownDays")}
            value={
              <>
                <span className="text-[var(--gain)]">{stats.upDays}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-[var(--loss)]">{stats.downDays}</span>
              </>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  valueClass,
  sub,
  subClass,
  className,
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  sub?: string;
  subClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-semibold leading-tight tabular-nums",
          valueClass ?? "text-foreground",
        )}
      >
        {value}
      </span>
      {sub !== undefined && (
        <span
          className={cn("text-[11px] leading-tight tabular-nums text-muted-foreground", subClass)}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
