"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useFormatter } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";

const CELL_PX = 10;
const GAP_PX = 4;
const COL_WIDTH = CELL_PX + GAP_PX;

// Fixed reference dates for day-of-week label generation
const DOW_REF: (Date | null)[] = [
  new Date(2024, 0, 7), // Sun
  null,
  new Date(2024, 0, 9), // Tue
  null,
  new Date(2024, 0, 11), // Thu
  null,
  new Date(2024, 0, 13), // Sat
];

type SnapshotRow = {
  id: string;
  date: string; // YYYY-MM-DD
  netWorth: number;
};

type GridDay = {
  date: Date;
  dateString: string;
  hasSnapshot: boolean;
  netWorth?: number;
  change: number | null;
  isFuture: boolean;
  isNextYear: boolean;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
};

export function HistoryHeatmap({ snapshots, baseCurrency }: Props) {
  const format = useFormatter();
  const { privacyMode } = usePrivacyMode();
  const [selectedDay, setSelectedDay] = useState<GridDay | null>(null);

  const { gridDays, monthLabels, maxPos, maxNeg, weeksToShow, currentYear, todayColIndex } =
    useMemo(() => {
    // 1. Sort snapshots chronologically (oldest first) to easily calculate deltas
    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    let maxPositiveChange = 0;
    let maxNegativeChange = 0;

    // 2. Create a lookup map of snapshot dates with pre-calculated changes (O(N))
    const snapshotMap = new Map<string, SnapshotRow & { change: number | null }>();

    for (let i = 0; i < sortedSnapshots.length; i++) {
      const snap = sortedSnapshots[i]!;
      const prevSnap = i > 0 ? sortedSnapshots[i - 1] : null;
      const change = prevSnap ? snap.netWorth - prevSnap.netWorth : null;

      if (change !== null) {
        if (change > maxPositiveChange) maxPositiveChange = change;
        if (change < maxNegativeChange) maxNegativeChange = change;
      }

      snapshotMap.set(snap.date, { ...snap, change });
    }

    // 3. Determine end date (Saturday on or after Dec 31st of current year)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const dec31 = new Date(currentYear, 11, 31);
    const dayOfWeekEnd = dec31.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToAddToReachSaturday = 6 - dayOfWeekEnd;
    const endDate = new Date(dec31);
    endDate.setDate(dec31.getDate() + daysToAddToReachSaturday);

    // 4. Determine start date (Sunday on or before Jan 1st of current year)
    const jan1 = new Date(currentYear, 0, 1);
    const dayOfWeekStart = jan1.getDay();
    const startDate = new Date(jan1);
    startDate.setDate(jan1.getDate() - dayOfWeekStart);

    // 5. Calculate total days to show
    const daysToShow =
      Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weeksToShow = daysToShow / 7;

    const days: GridDay[] = [];
    const mLabels: { col: number; label: string }[] = [];
    let currentMonth = -1;

    for (let i = 0; i < daysToShow; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);

      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      const snapData = snapshotMap.get(dateString);

      // Track month boundaries for labels (only if we are still in the current year)
      if (year === currentYear && current.getMonth() !== currentMonth && current.getDate() < 15) {
        currentMonth = current.getMonth();
        mLabels.push({
          col: Math.floor(i / 7),
          label: format.dateTime(current, { month: "short" }),
        });
      }

      days.push({
        date: current,
        dateString,
        hasSnapshot: !!snapData,
        netWorth: snapData?.netWorth,
        change: snapData?.change ?? null,
        isFuture: current > today,
        isNextYear: year > currentYear,
      });
    }

    // Column index of the current week, used to seed the initial scroll position
    const todayDayOffset = Math.round(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const todayColIndex = Math.floor(todayDayOffset / 7);

    return {
      gridDays: days,
      monthLabels: mLabels,
      maxPos: maxPositiveChange,
      maxNeg: Math.abs(maxNegativeChange),
      weeksToShow,
      currentYear,
      todayColIndex,
    };
  }, [snapshots, format]);

  // Transpose the flat array into 7 rows (Sunday–Saturday)
  const rows = useMemo(() => {
    const result: (GridDay | undefined)[][] = [];
    for (let i = 0; i < 7; i++) {
      const row: (GridDay | undefined)[] = [];
      for (let j = 0; j < weeksToShow; j++) {
        row.push(gridDays[j * 7 + i]);
      }
      result.push(row);
    }
    return result;
  }, [gridDays, weeksToShow]);

  const daysOfWeek = useMemo(
    () => DOW_REF.map((d) => (d ? format.dateTime(d, { weekday: "narrow" }) : "")),
    [format],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // On mount, position the scroll so today sits near the right edge of the visible window.
  // This shows recent activity immediately without requiring the user to scroll on mobile.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetLeft = (todayColIndex - 8) * COL_WIDTH;
    el.scrollLeft = Math.max(0, targetLeft);
  }, [todayColIndex]);

  return (
    <div className="w-full">
      {/*
        Relative wrapper lets the fade overlay sit on top of the scroll container
        without affecting layout. The fade uses mask-image on the scroll div itself
        so it fades the content edge, not a positioned overlay that blocks interaction.
      */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-none pb-1 [mask-image:linear-gradient(to_right,black_0%,black_88%,transparent_100%)]"
      >
        <div className="inline-flex flex-col min-w-max">
          {/* Month Labels */}
          <div className="flex text-xs text-muted-foreground/70 mb-1 ml-6 relative h-4">
            {monthLabels.map((m, i) => (
              <span key={i} className="absolute" style={{ left: `${m.col * COL_WIDTH}px` }}>
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Day Labels */}
            <div className="flex flex-col justify-between text-[10px] text-muted-foreground/50 leading-[10px] py-[2px]">
              {daysOfWeek.map((day, i) => (
                <span
                  key={i}
                  aria-hidden={day === "" ? true : undefined}
                  className="h-[10px] w-4 text-right"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div
              role="grid"
              aria-label={`${currentYear} net worth activity`}
              aria-rowcount={7}
              aria-colcount={weeksToShow}
              className="flex flex-col gap-1"
            >
              {rows.map((row, rIdx) => (
                <div key={rIdx} role="row" aria-rowindex={rIdx + 1} className="flex gap-1">
                  {row.map((day, cIdx) => {
                    // Padding cells outside the current year — hide from AT
                    if (!day || day.isNextYear) {
                      return (
                        <div
                          key={cIdx}
                          role="gridcell"
                          aria-hidden="true"
                          className="w-[10px] h-[10px]"
                        />
                      );
                    }

                    const isClickable = day.hasSnapshot && !day.isFuture;

                    const dateLabel = format.dateTime(day.date, { dateStyle: "medium" });
                    const cellLabel = day.isFuture
                      ? `${dateLabel}, no data yet`
                      : day.hasSnapshot
                        ? `${dateLabel}, net worth ${
                            privacyMode
                              ? "hidden"
                              : formatCurrency(day.netWorth!, baseCurrency)
                          }${
                            day.change !== null
                              ? `, change ${
                                  privacyMode
                                    ? "hidden"
                                    : (day.change >= 0 ? "+" : "") +
                                      formatCurrency(day.change, baseCurrency)
                                }`
                              : ""
                          }`
                        : `${dateLabel}, no snapshot`;

                    const title = day.isFuture
                      ? undefined
                      : day.hasSnapshot
                        ? `${dateLabel}\n${
                            privacyMode ? "***" : formatCurrency(day.netWorth!, baseCurrency)
                          }${
                            day.change !== null && !privacyMode
                              ? ` (${day.change >= 0 ? "+" : ""}${formatCurrency(day.change, baseCurrency)})`
                              : ""
                          }`
                        : dateLabel;

                    let bgClass = "bg-muted/40 dark:bg-muted/20";
                    if (!day.isFuture && day.hasSnapshot) {
                      if (day.change !== null && day.change < 0) {
                        const intensity = maxNeg > 0 ? Math.abs(day.change) / maxNeg : 1;
                        if (intensity < 0.25) bgClass = "bg-destructive/20";
                        else if (intensity < 0.5) bgClass = "bg-destructive/40";
                        else if (intensity < 0.75) bgClass = "bg-destructive/60";
                        else if (intensity < 0.95) bgClass = "bg-destructive/80";
                        else bgClass = "bg-destructive";
                      } else {
                        const intensity =
                          maxPos > 0 && day.change !== null ? day.change / maxPos : 1;
                        if (intensity < 0.25) bgClass = "bg-primary/20";
                        else if (intensity < 0.5) bgClass = "bg-primary/40";
                        else if (intensity < 0.75) bgClass = "bg-primary/60";
                        else if (intensity < 0.95) bgClass = "bg-primary/80";
                        else bgClass = "bg-primary";
                      }
                    }

                    return (
                      <div
                        key={cIdx}
                        role="gridcell"
                        aria-colindex={cIdx + 1}
                        aria-label={cellLabel}
                        aria-selected={selectedDay?.dateString === day.dateString}
                        title={title}
                        tabIndex={isClickable ? 0 : -1}
                        onClick={isClickable ? () => setSelectedDay(day) : undefined}
                        onKeyDown={
                          isClickable
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedDay(day);
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          "w-[10px] h-[10px] rounded-[2px]",
                          isClickable && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                          bgClass,
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tap-to-reveal callout — works on all devices, unlike title attribute */}
      {selectedDay && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 animate-in fade-in duration-150">
          <div className="flex gap-6 min-w-0">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {format.dateTime(selectedDay.date, { dateStyle: "medium" })}
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                {privacyMode ? "***" : formatCurrency(selectedDay.netWorth!, baseCurrency)}
              </p>
            </div>
            {selectedDay.change !== null && (
              <div className="shrink-0">
                <p className="text-xs text-muted-foreground">Change</p>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums mt-0.5",
                    selectedDay.change > 0
                      ? "text-primary"
                      : selectedDay.change < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {privacyMode
                    ? "***"
                    : (selectedDay.change >= 0 ? "+" : "") +
                      formatCurrency(selectedDay.change, baseCurrency)}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSelectedDay(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
