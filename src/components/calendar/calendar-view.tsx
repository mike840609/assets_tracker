"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ListChecks, Plus } from "lucide-react";

import { CalendarDayAgenda } from "@/components/calendar/calendar-day-agenda";
import { CalendarEarningsManager } from "@/components/calendar/calendar-earnings-manager";
import { CalendarEntryForm } from "@/components/calendar/calendar-entry-form";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { buildCalendarNavigationHref } from "@/components/calendar/calendar-navigation";
import { groupCalendarEntriesByDate } from "@/components/calendar/calendar-view-model";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { Button } from "@/components/ui/button";
import { getVisibleCalendarRange, moveCalendarMonth } from "@/lib/calendar-date";
import type { CalendarEarningsItem } from "@/lib/services/calendar-earnings-data";
import type { SerializedCalendarEntry } from "@/lib/types";

type CalendarViewProps = {
  initialEntries: SerializedCalendarEntry[];
  month: string;
  selectedDate: string;
  today: string;
  locale: string;
  showHeader?: boolean;
  /** Optional server-rendered seed. The client refreshes it in the background. */
  initialEarningsByDate?: ReadonlyMap<string, CalendarEarningsItem[]>;
};

export function CalendarView({
  initialEntries,
  selectedDate,
  today,
  locale,
  showHeader = true,
  initialEarningsByDate,
}: CalendarViewProps) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const pathname = usePathname();
  const entriesByDate = useMemo(() => groupCalendarEntriesByDate(initialEntries), [initialEntries]);
  const agendaRef = useRef<HTMLDivElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SerializedCalendarEntry | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticDate, setOptimisticDate] = useOptimistic(selectedDate);
  const effectiveDate = optimisticDate;
  const effectiveMonth = effectiveDate.slice(0, 7);
  const [earningsByDate, setEarningsByDate] = useState<ReadonlyMap<string, CalendarEarningsItem[]>>(
    () => initialEarningsByDate ?? new Map(),
  );
  const [earningsError, setEarningsError] = useState(false);
  const [earningsRetryKey, setEarningsRetryKey] = useState(0);

  // Earnings come from a provider quote, so they must not block the server
  // render. Fetch them after hydration instead; the month grid renders
  // immediately and updates when the request settles.
  useEffect(() => {
    const { from, to } = getVisibleCalendarRange(effectiveMonth);
    const controller = new AbortController();
    fetch(`/api/calendar-earnings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`earnings request failed: ${response.status}`);
        const payload = (await response.json()) as {
          data?: { earnings?: CalendarEarningsItem[] };
        };
        const grouped = new Map<string, CalendarEarningsItem[]>();
        for (const item of payload.data?.earnings ?? []) {
          const day = grouped.get(item.date) ?? [];
          day.push(item);
          grouped.set(item.date, day);
        }
        setEarningsError(false);
        setEarningsByDate(grouped);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEarningsError(true);
      });
    return () => controller.abort();
  }, [effectiveMonth, earningsRetryKey]);

  function navigate(date: string) {
    startTransition(() => {
      setOptimisticDate(date);
      router.replace(
        buildCalendarNavigationHref({
          pathname,
          search: window.location.search,
          hash: window.location.hash,
          date,
        }),
        { scroll: false },
      );
    });
  }

  function selectDate(date: string, source: "pointer" | "keyboard") {
    navigate(date);
    if (source !== "pointer" || !window.matchMedia("(max-width: 767px)").matches) return;

    requestAnimationFrame(() => {
      agendaRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }

  function addEntry() {
    setEditingEntry(null);
    setFormOpen(true);
  }

  function editEntry(entry: SerializedCalendarEntry) {
    setEditingEntry(entry);
    setFormOpen(true);
  }

  function handleMutationComplete() {
    setFormOpen(false);
    setEditingEntry(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {showHeader && (
        <header className="space-y-1">
          <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          <p className="max-w-3xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </header>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            mobileTouch
            aria-label={t("previousMonth")}
            title={t("previousMonth")}
            onClick={() => navigate(moveCalendarMonth(effectiveDate, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button type="button" variant="outline" mobileTouch onClick={() => navigate(today)}>
            {t("today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            mobileTouch
            aria-label={t("nextMonth")}
            title={t("nextMonth")}
            onClick={() => navigate(moveCalendarMonth(effectiveDate, 1))}
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" mobileTouch onClick={() => setManagerOpen(true)}>
            <ListChecks data-icon="inline-start" />
            {t("earningsWatch.manage")}
          </Button>
          <Button type="button" mobileTouch onClick={addEntry}>
            <Plus data-icon="inline-start" />
            {t("addEntry")}
          </Button>
        </div>
      </div>

      {earningsError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
          <span>{t("earningsUnavailable")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            mobileTouch
            onClick={() => {
              setEarningsError(false);
              setEarningsRetryKey((key) => key + 1);
            }}
          >
            {t("earningsRetry")}
          </Button>
        </div>
      )}

      <div className="gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] md:items-start">
        <CalendarMonthGrid
          month={effectiveMonth}
          selectedDate={effectiveDate}
          today={today}
          entriesByDate={entriesByDate}
          locale={locale}
          onSelectDate={selectDate}
          earningsByDate={earningsByDate}
        />
        <div ref={agendaRef} className="mt-4 scroll-mt-4 md:sticky md:top-4 md:mt-0">
          <CalendarDayAgenda
            date={effectiveDate}
            entries={entriesByDate.get(effectiveDate) ?? []}
            earnings={earningsByDate?.get(effectiveDate) ?? []}
            locale={locale}
            onAdd={addEntry}
            onEdit={editEntry}
            onDeleted={handleMutationComplete}
          />
        </div>
      </div>

      <CalendarEntryForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingEntry(null);
        }}
        selectedDate={selectedDate}
        entry={editingEntry}
        onSaved={handleMutationComplete}
      />

      <CalendarEarningsManager open={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
}
