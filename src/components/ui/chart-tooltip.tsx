"use client";

import React from "react";

interface ChartTooltipRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
  indicatorColor?: string;
}

export function ChartTooltipRow({
  label,
  value,
  valueClassName,
  indicatorColor,
}: ChartTooltipRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 text-[11px] leading-relaxed">
      <div className="flex items-center gap-1.5 min-w-0">
        {indicatorColor && (
          <div
            className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: indicatorColor }}
          />
        )}
        <span className="text-muted-foreground truncate">{label}</span>
      </div>
      <span
        className={`font-medium tabular-nums whitespace-nowrap ${valueClassName || "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

interface ChartTooltipContainerProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartTooltipContainer({
  title,
  children,
  className = "",
}: ChartTooltipContainerProps) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-popover/95 backdrop-blur-md px-3 py-2.5 shadow-xl ring-1 ring-black/5 dark:ring-white/5 space-y-1.5 min-w-[140px] ${className}`}
    >
      {title && (
        <div className="font-semibold text-xs text-foreground/90 pb-1 border-b border-border/40 mb-1.5">
          {title}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}
