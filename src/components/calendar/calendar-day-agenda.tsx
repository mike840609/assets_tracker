"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";

import { CalendarCategoryBadge } from "@/components/calendar/calendar-category-badge";
import {
  formatCalendarWallClock,
  sortCalendarDayEntries,
} from "@/components/calendar/calendar-view-model";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SerializedCalendarEntry } from "@/lib/types";

type CalendarDayAgendaProps = {
  date: string;
  entries: readonly SerializedCalendarEntry[];
  locale: string;
  onAdd: () => void;
  onEdit: (entry: SerializedCalendarEntry) => void;
  onDeleted: () => void;
};

export function CalendarDayAgenda({
  date,
  entries,
  locale,
  onAdd,
  onEdit,
  onDeleted,
}: CalendarDayAgendaProps) {
  const t = useTranslations("calendar");
  const common = useTranslations("common");
  const [pendingDelete, setPendingDelete] = useState<SerializedCalendarEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sortedEntries = useMemo(() => sortCalendarDayEntries(entries), [entries]);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00.000Z`)),
    [date, locale],
  );

  async function deleteEntry(entry: SerializedCalendarEntry) {
    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/calendar-entries/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();

      toast.success(t("deleteSuccess"));
      setPendingDelete(null);
      onDeleted();
    } catch {
      toast.error(t("deleteFailure"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      aria-label={t("entriesOnDate", { count: sortedEntries.length, date: dateLabel })}
      className="min-w-0 rounded-xl border bg-card"
    >
      <header className="border-b px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">{t("selectedDate")}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{dateLabel}</h2>
          <span className="text-xs text-muted-foreground">
            {t("entryCount", { count: sortedEntries.length })}
          </span>
        </div>
      </header>

      {sortedEntries.length === 0 ? (
        <div className="flex min-h-52 flex-col items-start justify-center px-4 py-8">
          <p className="font-medium text-foreground">{t("emptyTitle")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("emptyDescription")}</p>
          <Button size="sm" mobileTouch className="mt-4" onClick={onAdd}>
            <Plus data-icon="inline-start" />
            {t("addEntry")}
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {sortedEntries.map((entry) => {
            const timeLabel =
              entry.startTimeMinutes === null
                ? t("allDay")
                : [formatCalendarWallClock(entry.startTimeMinutes, locale), entry.timeZone]
                    .filter(Boolean)
                    .join(" · ");

            return (
              <article key={entry.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarCategoryBadge category={entry.category} />
                  <span className="text-xs tabular-nums text-muted-foreground">{timeLabel}</span>
                </div>

                <h3 className="mt-2 text-sm font-semibold text-foreground">{entry.title}</h3>
                {entry.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {entry.sourceUrl && (
                    <Button
                      render={
                        <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" />
                      }
                      variant="ghost"
                      size="xs"
                      mobileTouch
                    >
                      <ExternalLink data-icon="inline-start" />
                      {t("source")}
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" mobileTouch onClick={() => onEdit(entry)}>
                    {t("edit")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="xs"
                    mobileTouch
                    onClick={() => setPendingDelete(entry)}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { title: pendingDelete?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 md:min-h-0" disabled={deletingId !== null}>
              {common("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 md:min-h-0"
              variant="destructive"
              disabled={deletingId !== null}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) void deleteEntry(pendingDelete);
              }}
            >
              {deletingId !== null ? common("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
