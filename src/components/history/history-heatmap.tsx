"use client";

import { useCallback, useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";

const CELL_PX = 10;
const GAP_PX = 4;
const COL_WIDTH = CELL_PX + GAP_PX;
const CALENDAR_TIME_ZONE = "UTC";
const DAY_MS = 24 * 60 * 60 * 1000;

function calendarDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function calendarDateFromString(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return calendarDate(year, month - 1, day);
}

function utcToday() {
  const now = new Date();
  return calendarDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function utcDateString(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Fixed reference dates for day-of-week label generation
const DOW_REF: (Date | null)[] = [
  calendarDate(2024, 0, 7), // Sun
  null,
  calendarDate(2024, 0, 9), // Tue
  null,
  calendarDate(2024, 0, 11), // Thu
  null,
  calendarDate(2024, 0, 13), // Sat
];

type SnapshotRow = {
  id: string;
  date: string; // YYYY-MM-DD
  netWorth: number;
  label?: string | null;
  note?: string | null;
};

type GridDay = {
  date: Date;
  dateString: string;
  hasSnapshot: boolean;
  netWorth?: number;
  label?: string | null;
  note?: string | null;
  change: number | null;
  isFuture: boolean;
  isOutsideYear: boolean;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
  selectedDate?: string | null;
  onSelectedDateChange?: (date: string) => void;
  labels?: {
    netWorth: string;
    change: string;
  };
};

export function HistoryHeatmap({
  snapshots,
  baseCurrency,
  selectedDate,
  onSelectedDateChange,
  labels,
}: Props) {
  const format = useFormatter();
  const t = useTranslations("history");
  const { privacyMode } = usePrivacyMode();
  const [tooltip, setTooltip] = useState<{ day: GridDay; x: number; y: number } | null>(null);
  const tooltipLabels = labels ?? { netWorth: "Net Worth", change: "Change" };

  const {
    gridDays,
    monthLabels,
    maxPos,
    maxNeg,
    weeksToShow,
    currentYear,
    selectedColIndex,
    todayString,
    activeDateString,
  } = useMemo(() => {
    // 1. Sort snapshots chronologically (oldest first) to easily calculate deltas
    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    // 2. Create a lookup map of snapshot dates with pre-calculated changes (O(N))
    const snapshotMap = new Map<string, SnapshotRow & { change: number | null }>();

    for (let i = 0; i < sortedSnapshots.length; i++) {
      const snap = sortedSnapshots[i]!;
      const prevSnap = i > 0 ? sortedSnapshots[i - 1] : null;
      const change = prevSnap ? snap.netWorth - prevSnap.netWorth : null;

      snapshotMap.set(snap.date, { ...snap, change });
    }

    // 3. Show the year containing the selected snapshot. The latest snapshot is
    // the default, while inspecting an older trend point moves the heatmap with it.
    const today = utcToday();
    const todayString = utcDateString(today);
    const activeDateString = selectedDate ?? sortedSnapshots.at(-1)?.date ?? todayString;
    const activeDate = calendarDateFromString(activeDateString);
    const currentYear = Number.isNaN(activeDate.getTime())
      ? today.getUTCFullYear()
      : activeDate.getUTCFullYear();

    // 4. Determine end date (Saturday on or after Dec 31st of the active year)
    const dec31 = calendarDate(currentYear, 11, 31);
    const dayOfWeekEnd = dec31.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const daysToAddToReachSaturday = 6 - dayOfWeekEnd;
    const endDate = addUtcDays(dec31, daysToAddToReachSaturday);

    // 5. Determine start date (Sunday on or before Jan 1st of the active year)
    const jan1 = calendarDate(currentYear, 0, 1);
    const dayOfWeekStart = jan1.getUTCDay();
    const startDate = addUtcDays(jan1, -dayOfWeekStart);

    // 6. Calculate total days to show
    const daysToShow = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    const weeksToShow = daysToShow / 7;

    const days: GridDay[] = [];
    const mLabels: { col: number; label: string }[] = [];
    let currentMonth = -1;
    let maxPositiveChange = 0;
    let maxNegativeChange = 0;

    for (let i = 0; i < daysToShow; i++) {
      const current = addUtcDays(startDate, i);

      const year = current.getUTCFullYear();
      const monthIndex = current.getUTCMonth();
      const dateString = utcDateString(current);

      const snapData = snapshotMap.get(dateString);
      const isFuture = current.getTime() > today.getTime();
      const isOutsideYear = year !== currentYear;
      const change = snapData?.change ?? null;

      // Track month boundaries for labels (only if we are still in the current year)
      if (year === currentYear && monthIndex !== currentMonth && current.getUTCDate() < 15) {
        currentMonth = monthIndex;
        mLabels.push({
          col: Math.floor(i / 7),
          label: format.dateTime(calendarDate(year, monthIndex, 1), {
            month: "short",
            timeZone: CALENDAR_TIME_ZONE,
          }),
        });
      }

      if (!isFuture && !isOutsideYear && change !== null) {
        if (change > maxPositiveChange) maxPositiveChange = change;
        if (change < maxNegativeChange) maxNegativeChange = change;
      }

      days.push({
        date: current,
        dateString,
        hasSnapshot: !!snapData,
        netWorth: snapData?.netWorth,
        label: snapData?.label ?? null,
        note: snapData?.note ?? null,
        change,
        isFuture,
        isOutsideYear,
      });
    }

    // Column index of the selected week, used to keep the inspected day visible.
    const selectedDayOffset = Math.round((activeDate.getTime() - startDate.getTime()) / DAY_MS);
    const selectedColIndex = Number.isNaN(selectedDayOffset)
      ? 0
      : Math.floor(selectedDayOffset / 7);

    return {
      gridDays: days,
      monthLabels: mLabels,
      maxPos: maxPositiveChange,
      maxNeg: Math.abs(maxNegativeChange),
      weeksToShow,
      currentYear,
      selectedColIndex,
      todayString,
      activeDateString,
    };
  }, [snapshots, format, selectedDate]);

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
    () =>
      DOW_REF.map((d) =>
        d ? format.dateTime(d, { weekday: "narrow", timeZone: CALENDAR_TIME_ZONE }) : "",
      ),
    [format],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dismissTooltip = useCallback(() => setTooltip(null), []);

  // Keep the selected week near the right edge so trend-chart inspection remains
  // visible on narrow screens, including when selection crosses into another year.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetLeft = (selectedColIndex - 8) * COL_WIDTH;
    el.scrollLeft = Math.max(0, targetLeft);
  }, [selectedColIndex]);

  const showTooltipAtElement = (day: GridDay, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top });
  };

  // The tooltip is portaled and fixed to the viewport. On touch devices, a
  // focused cell can keep it alive after the page scrolls away, so any viewport
  // or heatmap movement should dismiss it instead of leaving a stale float.
  useEffect(() => {
    if (!tooltip) return;

    const heatmapScroller = scrollContainerRef.current;
    const pageScroller = document.querySelector("main");

    heatmapScroller?.addEventListener("scroll", dismissTooltip, { passive: true });
    pageScroller?.addEventListener("scroll", dismissTooltip, { passive: true });
    window.addEventListener("scroll", dismissTooltip, { passive: true });
    window.addEventListener("touchmove", dismissTooltip, { passive: true });
    window.addEventListener("wheel", dismissTooltip, { passive: true });
    window.addEventListener("resize", dismissTooltip);
    window.addEventListener("orientationchange", dismissTooltip);

    return () => {
      heatmapScroller?.removeEventListener("scroll", dismissTooltip);
      pageScroller?.removeEventListener("scroll", dismissTooltip);
      window.removeEventListener("scroll", dismissTooltip);
      window.removeEventListener("touchmove", dismissTooltip);
      window.removeEventListener("wheel", dismissTooltip);
      window.removeEventListener("resize", dismissTooltip);
      window.removeEventListener("orientationchange", dismissTooltip);
    };
  }, [dismissTooltip, tooltip]);

  return (
    <div
      className={cn(
        "w-full transition-[filter] duration-300",
        privacyMode && "blur-sm pointer-events-none select-none",
      )}
      aria-hidden={privacyMode || undefined}
    >
      {/* Header: year label on the left, intensity legend on the right. Sits
          above the grid (not overlaid) so it never collides with the month
          labels, and gives the heatmap a visible title. */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          {t("activityYear", { year: currentYear })}
        </span>
        <div
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70"
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
      </div>

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
                    if (!day || day.isOutsideYear) {
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
                    const isToday = day.dateString === todayString;
                    const isSelected = day.dateString === activeDateString;

                    const dateLabel = format.dateTime(calendarDateFromString(day.dateString), {
                      dateStyle: "medium",
                      timeZone: CALENDAR_TIME_ZONE,
                    });
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
                          }${
                            !privacyMode && day.label ? `, label ${day.label}` : ""
                          }${!privacyMode && day.note ? `, note ${day.note}` : ""}`
                        : `${dateLabel}, no snapshot`;

                    // Future days sit fainter than past days with no snapshot, so the grid
                    // visibly bounds how far the tracking history actually reaches.
                    let bgClass = day.isFuture
                      ? "bg-muted/20 dark:bg-muted/10"
                      : "bg-muted/40 dark:bg-muted/20";
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
                        aria-label={isToday ? `${cellLabel}, today` : cellLabel}
                        aria-selected={isSelected}
                        tabIndex={canShowDetails ? 0 : -1}
                        onClick={
                          canShowDetails ? () => onSelectedDateChange?.(day.dateString) : undefined
                        }
                        onPointerEnter={
                          canShowDetails
                            ? (e) => {
                                // Anchor at the cell center (like keyboard focus) instead of
                                // tracking the cursor: a 10px cell makes per-pixel tooltip
                                // movement imperceptible, and dropping onPointerMove avoids
                                // re-rendering the whole grid on every mouse move.
                                if (e.pointerType === "mouse")
                                  showTooltipAtElement(day, e.currentTarget);
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
                            ? (e) => {
                                onSelectedDateChange?.(day.dateString);
                                showTooltipAtElement(day, e.currentTarget);
                              }
                            : undefined
                        }
                        onBlur={canShowDetails ? () => setTooltip(null) : undefined}
                        style={{ "--col": cIdx } as CSSProperties}
                        className={cn(
                          "w-[10px] h-[10px] rounded-[2px]",
                          // Only the year-to-date fills in; the blank future months stay put.
                          !day.isFuture && "history-cell-in",
                          canShowDetails &&
                            "cursor-pointer transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                          bgClass,
                          // Neutral ink ring tracks the snapshot being inspected without
                          // competing with the gain/loss fill.
                          isSelected && "ring-1 ring-foreground/60 dark:ring-foreground/70",
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
              {format.dateTime(calendarDateFromString(tooltip.day.dateString), {
                dateStyle: "medium",
                timeZone: CALENDAR_TIME_ZONE,
              })}
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
              {!privacyMode && (tooltip.day.label || tooltip.day.note) && (
                <div className="mt-1.5 space-y-1 border-t border-border/40 pt-1.5">
                  {tooltip.day.label && (
                    <div className="flex items-start justify-between gap-4 text-[11px] leading-relaxed">
                      <span className="shrink-0 text-muted-foreground">
                        {t("snapshotLabel.label")}
                      </span>
                      <span className="min-w-0 max-w-[13rem] text-right font-medium text-foreground">
                        {tooltip.day.label}
                      </span>
                    </div>
                  )}
                  {tooltip.day.note && (
                    <div className="space-y-0.5 text-[11px] leading-relaxed">
                      <span className="text-muted-foreground">{t("snapshotLabel.note")}</span>
                      <p className="max-w-[16rem] whitespace-pre-wrap text-foreground">
                        {tooltip.day.note}
                      </p>
                    </div>
                  )}
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
