"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  isCalendarEntryFormDirty,
  minutesToTimeInput,
  resolveEntryTimeZone,
  timeInputToMinutes,
} from "@/components/calendar/calendar-entry-form-utils";
import { DiscardConfirmDialog } from "@/components/discard-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { parseDateOnly } from "@/lib/calendar-date";
import {
  CALENDAR_ENTRY_CATEGORIES,
  type CalendarEntryCategoryValue,
  type SerializedCalendarEntry,
} from "@/lib/types";

type CalendarEntryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  entry: SerializedCalendarEntry | null;
  onSaved: () => void;
};

type FormErrors = Partial<Record<"title" | "date" | "time" | "category" | "source", string>>;

type MutationErrorResponse = {
  error?: {
    message?: string;
    issues?: {
      fieldErrors?: Record<string, string[] | undefined>;
    };
  };
};

function CalendarEntryFormController({
  open,
  onOpenChange,
  selectedDate,
  entry,
  onSaved,
}: CalendarEntryFormProps) {
  const t = useTranslations("calendar");
  const isMobile = useIsMobile();
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const dateId = `${fieldId}-date`;
  const timeId = `${fieldId}-time`;
  const categoryId = `${fieldId}-category`;
  const descriptionId = `${fieldId}-description`;
  const sourceId = `${fieldId}-source`;

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [eventDate, setEventDate] = useState(entry?.eventDate ?? selectedDate);
  const [time, setTime] = useState(minutesToTimeInput(entry?.startTimeMinutes ?? null));
  const [category, setCategory] = useState<CalendarEntryCategoryValue>(entry?.category ?? "OTHER");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(entry?.sourceUrl ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  const initialValues = {
    title: entry?.title ?? "",
    eventDate: entry?.eventDate ?? selectedDate,
    time: minutesToTimeInput(entry?.startTimeMinutes ?? null),
    category: entry?.category ?? ("OTHER" as const),
    description: entry?.description ?? "",
    sourceUrl: entry?.sourceUrl ?? "",
  };
  const currentValues = { title, eventDate, time, category, description, sourceUrl };
  const isDirty = isCalendarEntryFormDirty(initialValues, currentValues);
  const discardGuard = useDiscardGuard(isDirty, () => onOpenChange(false));

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const displayedTimeZone = time
    ? resolveEntryTimeZone(entry?.timeZone ?? null, browserTimeZone)
    : null;

  function requestOpenChange(nextOpen: boolean) {
    if (saving) return;
    if (nextOpen) onOpenChange(true);
    else discardGuard.requestClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    const minutes = timeInputToMinutes(time);

    if (!title.trim()) nextErrors.title = t("form.titleRequired");
    if (!parseDateOnly(eventDate)) nextErrors.date = t("form.dateInvalid");
    if (time && minutes === null) nextErrors.time = t("form.timeInvalid");
    if (!CALENDAR_ENTRY_CATEGORIES.includes(category)) {
      nextErrors.category = t("form.categoryInvalid");
    }
    if (sourceUrl.trim()) {
      try {
        const protocol = new URL(sourceUrl.trim()).protocol;
        if (protocol !== "http:" && protocol !== "https:") {
          nextErrors.source = t("form.sourceInvalid");
        }
      } catch {
        nextErrors.source = t("form.sourceInvalid");
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      const timeZone =
        minutes === null ? null : resolveEntryTimeZone(entry?.timeZone ?? null, browserTimeZone);
      const payload = {
        title,
        eventDate,
        startTimeMinutes: minutes,
        timeZone,
        category,
        description,
        sourceUrl,
      };
      const response = await fetch(
        entry ? `/api/calendar-entries/${encodeURIComponent(entry.id)}` : "/api/calendar-entries",
        {
          method: entry ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as MutationErrorResponse | null;
        const fieldErrors = body?.error?.issues?.fieldErrors;

        if (fieldErrors) {
          const serverErrors: FormErrors = {};
          if (fieldErrors.title) serverErrors.title = t("form.titleRequired");
          if (fieldErrors.eventDate) serverErrors.date = t("form.dateInvalid");
          if (fieldErrors.startTimeMinutes || fieldErrors.timeZone) {
            serverErrors.time = t("form.timeInvalid");
          }
          if (fieldErrors.category) serverErrors.category = t("form.categoryInvalid");
          if (fieldErrors.sourceUrl) serverErrors.source = t("form.sourceInvalid");

          if (Object.keys(serverErrors).length > 0) {
            setErrors(serverErrors);
            return;
          }
        }

        toast.error(t("form.failed"));
        return;
      }

      toast.success(t(entry ? "form.updated" : "form.created"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("form.failed"));
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <form noValidate onSubmit={handleSubmit} aria-busy={saving} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={titleId}>{t("form.title")}</Label>
        <Input
          id={titleId}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
          placeholder={t("form.titlePlaceholder")}
          maxLength={120}
          disabled={saving}
          autoFocus={!isMobile}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${titleId}-error` : undefined}
          className="min-h-11 md:min-h-8"
        />
        {errors.title && (
          <p id={`${titleId}-error`} role="alert" className="text-xs text-destructive">
            {errors.title}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={dateId}>{t("form.date")}</Label>
          <Input
            id={dateId}
            type="date"
            value={eventDate}
            onChange={(event) => {
              setEventDate(event.target.value);
              setErrors((current) => ({ ...current, date: undefined }));
            }}
            disabled={saving}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? `${dateId}-error` : undefined}
            className="min-h-11 md:min-h-8"
          />
          {errors.date && (
            <p id={`${dateId}-error`} role="alert" className="text-xs text-destructive">
              {errors.date}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={timeId}>{t("form.time")}</Label>
          <Input
            id={timeId}
            type="time"
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              setErrors((current) => ({ ...current, time: undefined }));
            }}
            disabled={saving}
            aria-invalid={Boolean(errors.time)}
            aria-describedby={[
              `${timeId}-hint`,
              displayedTimeZone ? `${timeId}-zone` : null,
              errors.time ? `${timeId}-error` : null,
            ]
              .filter(Boolean)
              .join(" ")}
            className="min-h-11 md:min-h-8"
          />
          <p id={`${timeId}-hint`} className="text-xs text-muted-foreground">
            {t("form.timeOptional")}
          </p>
          {displayedTimeZone && (
            <p id={`${timeId}-zone`} aria-live="polite" className="text-xs text-muted-foreground">
              {t("form.timeZone", { timeZone: displayedTimeZone })}
            </p>
          )}
          {errors.time && (
            <p id={`${timeId}-error`} role="alert" className="text-xs text-destructive">
              {errors.time}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={categoryId}>{t("form.category")}</Label>
        <Select
          value={category}
          disabled={saving}
          onValueChange={(value) => {
            if (!value) return;
            setCategory(value as CalendarEntryCategoryValue);
            setErrors((current) => ({ ...current, category: undefined }));
          }}
        >
          <SelectTrigger
            id={categoryId}
            aria-invalid={Boolean(errors.category)}
            aria-describedby={errors.category ? `${categoryId}-error` : undefined}
            className="min-h-11 w-full md:min-h-8"
          >
            <SelectValue>{t(`categories.${category}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_ENTRY_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value} className="min-h-11 md:min-h-0">
                {t(`categories.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p id={`${categoryId}-error`} role="alert" className="text-xs text-destructive">
            {errors.category}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={descriptionId}>{t("form.description")}</Label>
        <Textarea
          id={descriptionId}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("form.descriptionPlaceholder")}
          maxLength={4000}
          disabled={saving}
          className="min-h-24 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={sourceId}>{t("form.sourceUrl")}</Label>
        <Input
          id={sourceId}
          type="url"
          inputMode="url"
          value={sourceUrl}
          onChange={(event) => {
            setSourceUrl(event.target.value);
            setErrors((current) => ({ ...current, source: undefined }));
          }}
          placeholder={t("form.sourceUrlPlaceholder")}
          maxLength={2048}
          disabled={saving}
          aria-invalid={Boolean(errors.source)}
          aria-describedby={errors.source ? `${sourceId}-error` : undefined}
          className="min-h-11 md:min-h-8"
        />
        {errors.source && (
          <p id={`${sourceId}-error`} role="alert" className="text-xs text-destructive">
            {errors.source}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          mobileTouch
          className="w-full sm:w-auto"
          onClick={() => requestOpenChange(false)}
          disabled={saving}
        >
          {t("form.cancel")}
        </Button>
        <Button type="submit" mobileTouch className="w-full sm:w-auto" disabled={saving}>
          {saving ? t("saving") : t(entry ? "form.save" : "form.create")}
        </Button>
      </div>
    </form>
  );

  const titleText = t(entry ? "form.editTitle" : "form.createTitle");
  const discardDialog = (
    <DiscardConfirmDialog
      open={discardGuard.confirmOpen}
      onOpenChange={discardGuard.setConfirmOpen}
      onDiscard={discardGuard.confirmDiscard}
    />
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={requestOpenChange}>
          <DrawerContent showCloseButton={false}>
            <DrawerHeader>
              <DrawerTitle>{titleText}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">{form}</div>
          </DrawerContent>
        </Drawer>
        {discardDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>{titleText}</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
      {discardDialog}
    </>
  );
}

export function CalendarEntryForm(props: CalendarEntryFormProps) {
  const formKey = props.open ? `open:${props.entry?.id ?? `new:${props.selectedDate}`}` : "closed";

  return <CalendarEntryFormController key={formKey} {...props} />;
}
