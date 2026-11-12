"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { NetWorthSummary } from "@/lib/types";
import { LazyAllocationChart, LazyCurrencyExposureChart } from "./lazy-charts";

type CompositionView = "category" | "currency";

/** One card for "what is my money in": asset category and currency split of the same total. */
export function CompositionChart({ summary }: { summary: NetWorthSummary }) {
  const t = useTranslations("allocationChart");
  const [view, setView] = useState<CompositionView>("category");

  const toggle = (
    <SegmentedControl
      variant="pill"
      size="xs"
      options={[
        { value: "category", label: t("viewCategory") },
        { value: "currency", label: t("viewCurrency") },
      ]}
      value={view}
      onValueChange={setView}
      aria-label={t("viewLabel")}
      className="shrink-0 gap-0 bg-muted p-0.5"
    />
  );

  return view === "currency" ? (
    <LazyCurrencyExposureChart summary={summary} headerAction={toggle} />
  ) : (
    <LazyAllocationChart summary={summary} headerAction={toggle} />
  );
}
