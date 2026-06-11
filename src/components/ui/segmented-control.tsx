"use client";

import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
};

type SegmentedControlVariant = "pill" | "boxed" | "underline";
type SegmentedControlSize = "xs" | "sm" | "md";

const rootVariants: Record<SegmentedControlVariant, string> = {
  pill: "inline-flex flex-wrap items-center gap-1 rounded-full p-1",
  boxed: "inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/30 p-1",
  underline: "flex border-b",
};

/* The selected surface lives on a shared sliding indicator (one per group via
   layoutId), so the item classes only carry text treatment for each state. */
const itemVariants: Record<SegmentedControlVariant, string> = {
  pill: "rounded-full text-muted-foreground not-aria-pressed:hover:bg-muted aria-pressed:text-primary-foreground",
  boxed:
    "rounded-md text-muted-foreground font-medium hover:text-foreground aria-pressed:text-foreground aria-pressed:font-semibold",
  underline:
    "-mb-px rounded-none border-b-2 border-transparent px-4 pb-2 text-muted-foreground hover:text-foreground aria-pressed:text-primary",
};

const indicatorVariants: Record<SegmentedControlVariant, string> = {
  pill: "absolute inset-0 bg-primary",
  boxed: "absolute inset-0 border border-border bg-background shadow-sm",
  underline: "absolute inset-x-0 bottom-0 h-0.5 bg-primary",
};

/* Numeric radii (matching rounded-full / rounded-md) let framer-motion
   scale-correct the corners while the indicator stretches between items. */
const indicatorRadius: Record<SegmentedControlVariant, number> = {
  pill: 9999,
  boxed: 10,
  underline: 0,
};

const sizeVariants: Record<SegmentedControlSize, string> = {
  xs: "px-2 py-0.5 text-xs",
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  variant?: SegmentedControlVariant;
  size?: SegmentedControlSize;
  className?: string;
  itemClassName?: string;
  "aria-label"?: string;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  variant = "pill",
  size = "sm",
  className,
  itemClassName,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const reduceMotion = useReducedMotion();
  const indicatorTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div role="group" aria-label={ariaLabel} className={cn(rootVariants[variant], className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          aria-pressed={value === option.value}
          aria-label={option.ariaLabel}
          title={option.title}
          disabled={option.disabled}
          className={cn(
            "relative shrink-0 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
            itemVariants[variant],
            variant !== "underline" && sizeVariants[size],
            variant === "underline" && "text-sm font-medium capitalize",
            itemClassName,
          )}
        >
          {value === option.value && (
            <motion.span
              aria-hidden
              layoutId={`${groupId}-indicator`}
              className={indicatorVariants[variant]}
              style={{ borderRadius: indicatorRadius[variant] }}
              transition={indicatorTransition}
            />
          )}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export { SegmentedControl };
export type { SegmentedOption };
