"use client";

import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { CalendarCategoryBadge } from "@/components/calendar/calendar-category-badge";
import { addCalendarDays, buildMonthGrid, moveCalendarMonth } from "@/lib/calendar-date";
import { cn } from "@/lib/utils";
import type { SerializedCalendarEntry } from "@/lib/types";

type CalendarMonthGridProps = {
  month: string;
  selectedDate: string;
  today: string;
  entriesByDate: ReadonlyMap<string, readonly SerializedCalendarEntry[]>;
  locale: string;
  onSelectDate: (date: string) => void;
};

const MONDAY_UTC = Date.UTC(1970, 0, 5);
const DAY_MS = 86_400_000;

export function CalendarMonthGrid({
  month,
  selectedDate,
  today,
  entriesByDate,
  locale,
  onSelectDate,
}: CalendarMonthGridProps) {
  const t = useTranslations("calendar");
  const headingId = useId();
  const days = useMemo(() => buildMonthGrid(month), [month]);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusDate = useRef<string | null>(null);
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
    [locale],
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }),
    [locale],
  );
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        weekdayFormatter.format(new Date(MONDAY_UTC + index * DAY_MS)),
      ),
    [weekdayFormatter],
  );
  const monthLabel = monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));

  useEffect(() => {
    const focusDate = pendingFocusDate.current;
    if (!focusDate) return;
    const frame = requestAnimationFrame(() => {
      const button = buttonRefs.current.get(focusDate);
      if (!button) return;
      button.focus();
      pendingFocusDate.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [month, selectedDate]);

  function selectAndFocus(date: string) {
    pendingFocusDate.current = date;
    onSelectDate(date);
    requestAnimationFrame(() => {
      const button = buttonRefs.current.get(date);
      if (!button) return;
      button.focus();
      pendingFocusDate.current = null;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string, index: number) {
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      selectAndFocus(moveCalendarMonth(date, event.key === "PageUp" ? -1 : 1));
      return;
    }

    const delta =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp"
            ? -7
            : event.key === "ArrowDown"
              ? 7
              : event.key === "Home"
                ? -(index % 7)
                : event.key === "End"
                  ? 6 - (index % 7)
                  : null;

    if (delta === null) return;
    event.preventDefault();
    selectAndFocus(addCalendarDays(date, delta));
  }

  return (
    <section className="min-w-0" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-lg font-semibold text-foreground">
        {monthLabel}
      </h2>

      <div
        role="grid"
        aria-labelledby={headingId}
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div role="row" className="grid grid-cols-7 border-b bg-muted/40">
          {weekdays.map((weekday, index) => (
            <div
              key={`${weekday}-${index}`}
              role="columnheader"
              className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: 6 }, (_, weekIndex) => (
            <div key={weekIndex} role="row" className="contents">
              {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, dayIndex) => {
                const index = weekIndex * 7 + dayIndex;
                const entries = entriesByDate.get(date) ?? [];
                const categories = [...new Set(entries.map((entry) => entry.category))];
                const shownCategories = categories.slice(0, 3);
                const remainingCategories = categories.length - shownCategories.length;
                const isSelected = date === selectedDate;
                const isToday = date === today;
                const isCurrentMonth = date.startsWith(month);
                const fullDate = dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
                const countLabel = t("entryCount", { count: entries.length });

                return (
                  <div
                    key={date}
                    role="gridcell"
                    aria-selected={isSelected}
                    className={cn(
                      "min-w-0",
                      index % 7 !== 6 && "border-r",
                      index < 35 && "border-b",
                    )}
                  >
                    <button
                      ref={(button) => {
                        if (button) buttonRefs.current.set(date, button);
                        else buttonRefs.current.delete(date);
                      }}
                      type="button"
                      tabIndex={isSelected ? 0 : -1}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${fullDate}, ${countLabel}`}
                      onClick={() => selectAndFocus(date)}
                      onKeyDown={(event) => handleKeyDown(event, date, index)}
                      className={cn(
                        "flex min-h-16 w-full flex-col items-center gap-1 px-1.5 py-2 text-center outline-none motion-fast sm:min-h-20 sm:items-start sm:text-left",
                        "hover:bg-muted/60 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !isCurrentMonth && "text-muted-foreground/70",
                        isSelected && "relative z-10 bg-primary/8 ring-2 ring-inset ring-primary",
                      )}
                    >
                      <span className="flex min-h-7 flex-col items-center sm:items-start">
                        <span
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
                            isToday && "bg-primary text-primary-foreground font-semibold",
                          )}
                        >
                          {Number(date.slice(-2))}
                        </span>
                        {isToday && (
                          <span className="text-xs leading-none font-medium text-primary">
                            {t("today")}
                          </span>
                        )}
                      </span>

                      {entries.length > 0 && (
                        <span
                          aria-label={countLabel}
                          className="mt-auto flex min-h-4 max-w-full items-center justify-center gap-1 sm:justify-start"
                        >
                          {shownCategories.map((category) => (
                            <CalendarCategoryBadge key={category} category={category} compact />
                          ))}
                          {remainingCategories > 0 && (
                            <span className="text-xs leading-none font-medium text-muted-foreground">
                              +{remainingCategories}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
