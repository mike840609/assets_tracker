import type {
  MonthlyBucket,
  AnalysisKpis,
  CashFlowBucket,
  CumulativeGrowthPoint,
  CategoryDataPoint,
  AttributionItem,
  ReturnTrendPoint,
  InvestmentCostBasisSummary,
} from "@/lib/services/analysis-service";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import type { RangeLabel } from "@/lib/analysis-range";

export interface AnalysisRangeSeries {
  buckets: MonthlyBucket[];
  kpis: AnalysisKpis;
  cashFlowBuckets: CashFlowBucket[];
  cumulativeGrowth: CumulativeGrowthPoint[];
  categoryHistory: CategoryDataPoint[];
  attributionItems: AttributionItem[];
  investmentReturnPct: number | null;
  returnTrend: ReturnTrendPoint[];
  rangeStartIso: string;
}

export interface AnalysisPayloadMeta {
  defaultRange: RangeLabel;
}

export interface AnalysisPayload {
  seriesByRange: Record<RangeLabel, AnalysisRangeSeries>;
  investmentCostBasis: InvestmentCostBasisSummary;
  /** Full normalized history — used by the mobile #history tab (HistoryView). */
  snapshots: NormalizedSnapshot[];
  meta: AnalysisPayloadMeta;
}
