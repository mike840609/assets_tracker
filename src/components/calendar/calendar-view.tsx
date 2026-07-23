"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { CalendarDayAgenda } from "@/components/calendar/calendar-day-agenda";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { groupCalendarEntriesByDate } from "@/components/calendar/calendar-view-model";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { Button } from "@/components/ui/button";
import { moveCalendarMonth } from "@/lib/calendar-date";
import type { SerializedCalendarEntry } from "@/lib/types";

type CalendarViewProps = {
  initialEntries: SerializedCalendarEntry[];
  month: string;
  selectedDate: string;
  today: string;
  locale: string;
  showHeader?: boolean;
};

export function CalendarView({
  initialEntries,
  month,
  selectedDate,
  today,
  locale,
  showHeader = true,
}: CalendarViewProps) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const pathname = usePathname();
  const entriesByDate = useMemo(() => groupCalendarEntriesByDate(initialEntries), [initialEntries]);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SerializedCalendarEntry | null>(null);

  // Task 7 consumes these state values when it adds CalendarEntryForm.
  void formOpen;
  void editTarget;

  function navigate(date: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("month", date.slice(0, 7));
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}${window.location.hash}`, { scroll: false });
  }

  function addEntry() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function editEntry(entry: SerializedCalendarEntry) {
    setEditTarget(entry);
    setFormOpen(true);
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
            onClick={() => navigate(moveCalendarMonth(selectedDate, -1))}
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
            onClick={() => navigate(moveCalendarMonth(selectedDate, 1))}
          >
            <ChevronRight />
          </Button>
        </div>

        <Button type="button" mobileTouch onClick={addEntry}>
          <Plus data-icon="inline-start" />
          {t("addEntry")}
        </Button>
      </div>

      <div className="gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] md:items-start">
        <CalendarMonthGrid
          month={month}
          selectedDate={selectedDate}
          today={today}
          entriesByDate={entriesByDate}
          locale={locale}
          onSelectDate={navigate}
        />
        <div className="mt-4 md:mt-0">
          <CalendarDayAgenda
            date={selectedDate}
            entries={entriesByDate.get(selectedDate) ?? []}
            locale={locale}
            onAdd={addEntry}
            onEdit={editEntry}
            onDeleted={() => router.refresh()}
          />
        </div>
      </div>
    </div>
  );
}
