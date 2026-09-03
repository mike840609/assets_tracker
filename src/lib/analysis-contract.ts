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
  /**
   * True when at least one snapshot inside the range carries a breakdown entry
   * for an account that has since been deleted. Those values still count in the
   * net-worth trend (History falls back to the stored aggregates) but cannot be
   * placed in a category or attributed to an account, so the composition charts
   * omit them. The UI discloses the gap instead of silently disagreeing.
   */
  hasUnattributedAccounts: boolean;
}

export interface AnalysisPayloadMeta {
  defaultRange: RangeLabel;
}

export interface AnalysisPayload {
  seriesByRange: Partial<Record<RangeLabel, AnalysisRangeSeries>>;
  investmentCostBasis: InvestmentCostBasisSummary;
  /** Full normalized history — used by the mobile #history tab (HistoryView). */
  snapshots: NormalizedSnapshot[];
  meta: AnalysisPayloadMeta;
}
