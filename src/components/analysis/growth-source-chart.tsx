"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useRefocusPressed } from "@/hooks/use-refocus-pressed";
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
  const { ref: toggleRef, markSwitch } = useRefocusPressed();

  // Load the other view's chunk up front so switching never shows a loading skeleton.
  useEffect(() => {
    void import("./cashflow-chart");
  }, []);

  const toggle = (
    <span ref={toggleRef} className="contents">
      <SegmentedControl
        variant="pill"
        size="xs"
        options={[
          { value: "cumulative", label: t("growthViewCumulative") },
          { value: "monthly", label: t("growthViewMonthly") },
        ]}
        value={view}
        onValueChange={(next) => {
          markSwitch();
          setView(next);
        }}
        aria-label={t("growthViewLabel")}
        className="shrink-0 gap-0 bg-muted p-0.5"
        itemClassName="min-h-11 min-w-11 md:min-h-0 md:min-w-0"
      />
    </span>
  );

  return view === "monthly" ? (
    <LazyCashFlowChart buckets={buckets} baseCurrency={baseCurrency} headerAction={toggle} />
  ) : (
    <LazyCumulativeGrowthChart points={points} baseCurrency={baseCurrency} headerAction={toggle} />
  );
}
