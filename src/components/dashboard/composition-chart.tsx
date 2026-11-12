"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useRefocusPressed } from "@/hooks/use-refocus-pressed";
import type { NetWorthSummary } from "@/lib/types";
import { LazyAllocationChart, LazyCurrencyExposureChart } from "./lazy-charts";

type CompositionView = "category" | "currency";

/** One card for "what is my money in": asset category and currency split of the same total. */
export function CompositionChart({ summary }: { summary: NetWorthSummary }) {
  const t = useTranslations("allocationChart");
  const [view, setView] = useState<CompositionView>("category");
  const { ref: toggleRef, markSwitch } = useRefocusPressed();

  // Load the other view's chunk up front so switching never shows a loading skeleton.
  useEffect(() => {
    void import("./currency-exposure-chart");
  }, []);

  const toggle = (
    <span ref={toggleRef} className="contents">
      <SegmentedControl
        variant="pill"
        size="xs"
        options={[
          { value: "category", label: t("viewCategory") },
          { value: "currency", label: t("viewCurrency") },
        ]}
        value={view}
        onValueChange={(next) => {
          markSwitch();
          setView(next);
        }}
        aria-label={t("viewLabel")}
        className="shrink-0 gap-0 bg-muted p-0.5"
        itemClassName="min-h-11 min-w-11 md:min-h-0 md:min-w-0"
      />
    </span>
  );

  return view === "currency" ? (
    <LazyCurrencyExposureChart summary={summary} headerAction={toggle} />
  ) : (
    <LazyAllocationChart summary={summary} headerAction={toggle} />
  );
}
