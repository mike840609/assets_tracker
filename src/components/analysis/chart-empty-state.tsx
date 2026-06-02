import type { LucideIcon } from "lucide-react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** The chart-specific reason this is empty (e.g. "Not enough history to compute attribution."). */
  message: string;
  /** Shared, actionable follow-up shown beneath the message. Optional. */
  hint?: string;
  /** Min height. Defaults to a shared value so paired empty charts line up. */
  height?: number;
  icon?: LucideIcon;
  className?: string;
}

// Uniform across charts so two empty modules in a 2-col row are the same height.
const DEFAULT_EMPTY_HEIGHT = 240;

/**
 * One empty-state treatment for every analysis chart. Charts route their no-data
 * case through this instead of each rendering bare axes or a one-off centered
 * string, so a low-history account reads as "pending", not "broken".
 */
export function ChartEmptyState({
  message,
  hint,
  height = DEFAULT_EMPTY_HEIGHT,
  icon: Icon = CalendarClock,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 px-6 text-center",
        className,
      )}
      style={{ minHeight: height }}
    >
      <Icon className="size-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden />
      <p className="max-w-[34ch] text-pretty text-sm text-muted-foreground">{message}</p>
      {hint && <p className="max-w-[34ch] text-pretty text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
