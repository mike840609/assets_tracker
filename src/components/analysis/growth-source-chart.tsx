"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CashFlowBucket, CumulativeGrowthPoint } from "@/lib/services/analysis-service";
import { LazyCashFlowChart, LazyCumulativeGrowthChart } from "./lazy-analysis-charts";

type GrowthView = "cumulative" | "monthly";

interface Props {
  buckets: CashFlowBucket[];
  points: CumulativeGrowthPoint[];
  baseCurrency: string;
}

/** One card for "where did the change come from": cumulative and monthly views of the same split. */
export function GrowthSourceChart({ buckets, points, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const [view, setView] = useState<GrowthView>("cumulative");

  const toggle = (
    <SegmentedControl
      variant="pill"
      size="xs"
      options={[
        { value: "cumulative", label: t("growthViewCumulative") },
        { value: "monthly", label: t("growthViewMonthly") },
      ]}
      value={view}
      onValueChange={setView}
      aria-label={t("growthViewLabel")}
      className="shrink-0 gap-0 bg-muted p-0.5"
    />
  );

  return view === "monthly" ? (
    <LazyCashFlowChart buckets={buckets} baseCurrency={baseCurrency} headerAction={toggle} />
  ) : (
    <LazyCumulativeGrowthChart points={points} baseCurrency={baseCurrency} headerAction={toggle} />
  );
}
