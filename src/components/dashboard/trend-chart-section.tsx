import { type ReactNode } from "react";
import { type NormalizedSnapshot } from "@/lib/services/history-service";
import { LazyTrendChart } from "@/components/dashboard/lazy-charts";

export function TrendChartSection({
  baseCurrency,
  snapshots,
  footer,
}: {
  baseCurrency: string;
  snapshots: NormalizedSnapshot[];
  footer?: ReactNode;
}) {
  return <LazyTrendChart baseCurrency={baseCurrency} snapshots={snapshots} footer={footer} />;
}
