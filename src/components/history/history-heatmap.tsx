"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
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
  labels?: {
    netWorth: string;
    change: string;
  };
};

export function HistoryHeatmap({ snapshots, baseCurrency, labels }: Props) {
  const format = useFormatter();
  const t = useTranslations("history");
  const { privacyMode } = usePrivacyMode();
  const [tooltip, setTooltip] = useState<{ day: GridDay; x: number; y: number } | null>(null);
  const tooltipLabels = labels ?? { netWorth: "Net Worth", change: "Change" };

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

  const showTooltipAtElement = (day: GridDay, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <div
      className={cn(
        "relative w-full transition-[filter] duration-300",
        privacyMode && "blur-sm pointer-events-none select-none",
      )}
      aria-hidden={privacyMode || undefined}
    >
      {/* Intensity legend: decodes what each shade means. Absolutely positioned in
          the month-label band (top-right) so it adds no height — keeps the trend
          card, whose footer this is, at its original size. */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-1.5 bg-card/80 pl-2 text-[10px] text-muted-foreground/70 backdrop-blur-[2px]"
        aria-label={`${t("legendLoss")} – ${t("legendGain")}`}
      >
        <span aria-hidden="true">{t("legendLoss")}</span>
        <span className="size-[10px] rounded-[2px] bg-[var(--loss)]" aria-hidden="true" />
        <span className="size-[10px] rounded-[2px] bg-[var(--loss)]/50" aria-hidden="true" />
        <span
          className="size-[10px] rounded-[2px] bg-muted/40 dark:bg-muted/20"
          aria-hidden="true"
        />
        <span className="size-[10px] rounded-[2px] bg-[var(--gain)]/50" aria-hidden="true" />
        <span className="size-[10px] rounded-[2px] bg-[var(--gain)]" aria-hidden="true" />
        <span aria-hidden="true">{t("legendGain")}</span>
      </div>

      {/*
        Relative wrapper lets the fade overlay sit on top of the scroll container
        without affecting layout. The fade uses mask-image on the scroll div itself
        so it fades the content edge, not a positioned overlay that blocks interaction.
      */}
      <div
        ref={scrollContainerRef}
        title={t("scrollMonths")}
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

                    const canShowDetails = day.hasSnapshot && !day.isFuture;

                    const dateLabel = format.dateTime(day.date, { dateStyle: "medium" });
                    const cellLabel = day.isFuture
                      ? `${dateLabel}, no data yet`
                      : day.hasSnapshot
                        ? `${dateLabel}, net worth ${
                            privacyMode ? "hidden" : formatCurrency(day.netWorth!, baseCurrency)
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

                    let bgClass = "bg-muted/40 dark:bg-muted/20";
                    if (!day.isFuture && day.hasSnapshot) {
                      if (day.change !== null && day.change < 0) {
                        const intensity = maxNeg > 0 ? Math.abs(day.change) / maxNeg : 1;
                        if (intensity < 0.25) bgClass = "bg-[var(--loss)]/20";
                        else if (intensity < 0.5) bgClass = "bg-[var(--loss)]/40";
                        else if (intensity < 0.75) bgClass = "bg-[var(--loss)]/60";
                        else if (intensity < 0.95) bgClass = "bg-[var(--loss)]/80";
                        else bgClass = "bg-[var(--loss)]";
                      } else {
                        const intensity =
                          maxPos > 0 && day.change !== null ? day.change / maxPos : 1;
                        if (intensity < 0.25) bgClass = "bg-[var(--gain)]/20";
                        else if (intensity < 0.5) bgClass = "bg-[var(--gain)]/40";
                        else if (intensity < 0.75) bgClass = "bg-[var(--gain)]/60";
                        else if (intensity < 0.95) bgClass = "bg-[var(--gain)]/80";
                        else bgClass = "bg-[var(--gain)]";
                      }
                    }

                    return (
                      <div
                        key={cIdx}
                        role="gridcell"
                        aria-colindex={cIdx + 1}
                        aria-label={cellLabel}
                        aria-selected={tooltip?.day.dateString === day.dateString}
                        tabIndex={canShowDetails ? 0 : -1}
                        onPointerEnter={
                          canShowDetails
                            ? (e) => {
                                if (e.pointerType === "mouse") {
                                  setTooltip({ day, x: e.clientX, y: e.clientY });
                                }
                              }
                            : undefined
                        }
                        onPointerMove={
                          canShowDetails
                            ? (e) => {
                                if (e.pointerType === "mouse") {
                                  setTooltip({ day, x: e.clientX, y: e.clientY });
                                }
                              }
                            : undefined
                        }
                        onPointerLeave={
                          canShowDetails
                            ? (e) => {
                                if (e.pointerType === "mouse") setTooltip(null);
                              }
                            : undefined
                        }
                        onFocus={
                          canShowDetails
                            ? (e) => showTooltipAtElement(day, e.currentTarget)
                            : undefined
                        }
                        onBlur={canShowDetails ? () => setTooltip(null) : undefined}
                        className={cn(
                          "w-[10px] h-[10px] rounded-[2px]",
                          canShowDetails &&
                            "cursor-pointer transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
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

      {typeof document !== "undefined" &&
        tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[60] min-w-[180px] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-border/60 bg-popover/95 px-3 py-2.5 shadow-xl ring-1 ring-black/5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 dark:ring-white/5"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="border-b border-border/40 pb-1 text-xs font-semibold text-foreground/90">
              {format.dateTime(tooltip.day.date, { dateStyle: "medium" })}
            </p>
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between gap-6 text-[11px] leading-relaxed">
                <span className="text-muted-foreground">{tooltipLabels.netWorth}</span>
                <span className="font-medium tabular-nums whitespace-nowrap text-foreground">
                  {privacyMode ? "***" : formatCurrency(tooltip.day.netWorth!, baseCurrency)}
                </span>
              </div>
              {tooltip.day.change !== null && (
                <div className="flex items-center justify-between gap-6 text-[11px] leading-relaxed">
                  <span className="text-muted-foreground">{tooltipLabels.change}</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums whitespace-nowrap",
                      tooltip.day.change > 0
                        ? "text-[var(--gain)]"
                        : tooltip.day.change < 0
                          ? "text-[var(--loss)]"
                          : "text-muted-foreground",
                    )}
                  >
                    {privacyMode
                      ? "***"
                      : (tooltip.day.change >= 0 ? "+" : "") +
                        formatCurrency(tooltip.day.change, baseCurrency)}
                  </span>
                </div>
              )}
            </div>
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border/60 bg-popover/95"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
