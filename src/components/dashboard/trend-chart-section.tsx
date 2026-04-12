import { getNormalizedHistory } from "@/lib/services/history-service";
import { LazyTrendChart } from "@/components/dashboard/lazy-charts";

export async function TrendChartSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const snapshots = await getNormalizedHistory(userId, baseCurrency);
  return <LazyTrendChart baseCurrency={baseCurrency} snapshots={snapshots} />;
}
