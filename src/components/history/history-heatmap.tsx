"use client";

import { useMemo } from "react";
import { useFormatter } from "next-intl";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";

type SnapshotRow = {
  id: string;
  date: string; // YYYY-MM-DD
  netWorth: number;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
};

export function HistoryHeatmap({ snapshots, baseCurrency }: Props) {
  const format = useFormatter();
  const { privacyMode } = usePrivacyMode();

  const { gridDays, monthLabels, maxPos, maxNeg, weeksToShow } = useMemo(() => {
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

    const days = [];
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

    return {
      gridDays: days,
      monthLabels: mLabels,
      maxPos: maxPositiveChange,
      maxNeg: Math.abs(maxNegativeChange),
      weeksToShow,
    };
  }, [snapshots, format]);

  // Transpose the 1D array into 7 rows (Sunday - Saturday)
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const row = [];
    for (let j = 0; j < weeksToShow; j++) {
      row.push(gridDays[j * 7 + i]);
    }
    rows.push(row);
  }

  const daysOfWeek = [
    format.dateTime(new Date(2024, 0, 7), { weekday: "narrow" }), // Sun
    "",
    format.dateTime(new Date(2024, 0, 9), { weekday: "narrow" }), // Tue
    "",
    format.dateTime(new Date(2024, 0, 11), { weekday: "narrow" }), // Thu
    "",
    format.dateTime(new Date(2024, 0, 13), { weekday: "narrow" }), // Sat
  ];

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="inline-flex flex-col min-w-max">
          {/* Month Labels */}
          <div className="flex text-xs text-muted-foreground/70 mb-1 ml-6 relative h-4">
            {monthLabels.map((m, i) => (
              <span key={i} className="absolute" style={{ left: `${m.col * 14}px` }}>
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Day Labels */}
            <div className="flex flex-col justify-between text-[10px] text-muted-foreground/50 leading-[10px] py-[2px]">
              {daysOfWeek.map((day, i) => (
                <span key={i} className="h-[10px] w-4 text-right">
                  {day}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex flex-col gap-1">
              {rows.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-1">
                  {row.map((day, cIdx) => {
                    const title = day.isFuture
                      ? undefined
                      : day.hasSnapshot
                        ? `${format.dateTime(day.date, { dateStyle: "medium" })}\n${
                            privacyMode ? "***" : formatCurrency(day.netWorth!, baseCurrency)
                          }${
                            day.change !== null && !privacyMode
                              ? ` (${day.change >= 0 ? "+" : ""}${formatCurrency(day.change, baseCurrency)})`
                              : ""
                          }`
                        : format.dateTime(day.date, { dateStyle: "medium" });

                    let bgClass = "bg-muted/40 dark:bg-muted/20";
                    if (day.isNextYear) {
                      bgClass = "bg-transparent";
                    } else if (!day.isFuture && day.hasSnapshot) {
                      if (day.change !== null && day.change < 0) {
                        const intensity = maxNeg > 0 ? Math.abs(day.change) / maxNeg : 1;
                        if (intensity < 0.25) bgClass = "bg-destructive/20";
                        else if (intensity < 0.5) bgClass = "bg-destructive/40";
                        else if (intensity < 0.75) bgClass = "bg-destructive/60";
                        else if (intensity < 0.95) bgClass = "bg-destructive/80";
                        else bgClass = "bg-destructive";
                      } else {
                        // Positive or zero change, or no previous snapshot
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
                        title={title}
                        className={cn("w-[10px] h-[10px] rounded-[2px]", bgClass)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
