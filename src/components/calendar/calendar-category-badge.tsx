"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { CalendarEntryCategoryValue } from "@/lib/types";

const CATEGORY_TONES: Record<CalendarEntryCategoryValue, string> = {
  EARNINGS: "bg-primary/10 text-primary-ink",
  ECONOMIC_INDICATOR: "bg-chart-2/15 text-foreground",
  DIVIDEND: "bg-chart-3/15 text-foreground",
  FILING: "bg-chart-4/15 text-foreground",
  REMINDER: "bg-chart-7/15 text-foreground",
  OTHER: "bg-muted text-muted-foreground",
};

const CATEGORY_DOTS: Record<CalendarEntryCategoryValue, string> = {
  EARNINGS: "text-primary",
  ECONOMIC_INDICATOR: "text-chart-2",
  DIVIDEND: "text-chart-3",
  FILING: "text-chart-4",
  REMINDER: "text-chart-7",
  OTHER: "text-muted-foreground",
};

export function CalendarCategoryBadge({
  category,
  compact = false,
}: {
  category: CalendarEntryCategoryValue;
  compact?: boolean;
}) {
  const t = useTranslations("calendar");
  const label = t(`categories.${category}`);

  if (compact) {
    return (
      <span className={cn("inline-flex items-center", CATEGORY_DOTS[category])}>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs leading-none font-medium whitespace-nowrap",
        CATEGORY_TONES[category],
      )}
    >
      {label}
    </span>
  );
}
