import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCachedNetWorthSummary } from "./net-worth-service";
import { serializeAllocationTarget } from "@/lib/types";
import type { SerializedAllocationTarget, AllocationDriftItem, NetWorthSummary } from "@/lib/types";
import { HOLDING_ASSET_TYPES, ACCOUNT_CATEGORIES } from "@/lib/enums";

async function fetchUserAllocationTargetsInner(
  userId: string,
): Promise<SerializedAllocationTarget[]> {
  "use cache";
  cacheTag("allocation-targets");
  cacheTag(`allocation-targets:${userId}`);
  cacheLife("hours");
  const rows = await prisma.allocationTarget.findMany({
    where: { userId },
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });
  return rows.map(serializeAllocationTarget);
}

export const fetchUserAllocationTargets = cache(fetchUserAllocationTargetsInner);

/** Compute actual allocation percentages by asset type from NetWorthSummary. */
function computeAssetTypeAllocation(summary: NetWorthSummary): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const type of HOLDING_ASSET_TYPES) totals[type] = 0;

  for (const account of summary.accounts) {
    if (account.type !== "ASSET") continue;
    for (const holding of account.holdings) {
      if (holding.marketValue === null) continue;
      totals[holding.assetType] = (totals[holding.assetType] ?? 0) + holding.marketValue;
    }
  }

  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  if (grand === 0) return Object.fromEntries(Object.keys(totals).map((k) => [k, 0]));

  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, (v / grand) * 100]));
}

/** Compute actual allocation percentages by account category from NetWorthSummary. */
function computeAccountCategoryAllocation(summary: NetWorthSummary): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const cat of ACCOUNT_CATEGORIES) totals[cat] = 0;

  for (const account of summary.accounts) {
    if (account.type !== "ASSET") continue;
    totals[account.category] = (totals[account.category] ?? 0) + account.totalValueInBaseCurrency;
  }

  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  if (grand === 0) return Object.fromEntries(Object.keys(totals).map((k) => [k, 0]));

  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, (v / grand) * 100]));
}

/**
 * Compute drift items for all targets.
 * @param targets  Serialized allocation targets.
 * @param summary  Current net worth summary.
 * @param labelFn  Optional function to turn a key into a human-readable label.
 */
export function computeAllocationDrift(
  targets: SerializedAllocationTarget[],
  summary: NetWorthSummary,
  labelFn?: (scope: string, key: string) => string,
): AllocationDriftItem[] {
  if (targets.length === 0) return [];

  const assetTypeActuals = computeAssetTypeAllocation(summary);
  const categoryActuals = computeAccountCategoryAllocation(summary);

  return targets.map((t) => {
    const actuals = t.scope === "ASSET_TYPE" ? assetTypeActuals : categoryActuals;
    const actualPercent = actuals[t.key] ?? 0;
    const drift = actualPercent - t.targetPercent;
    return {
      scope: t.scope,
      key: t.key,
      label: labelFn ? labelFn(t.scope, t.key) : t.key,
      actualPercent,
      targetPercent: t.targetPercent,
      driftThreshold: t.driftThreshold,
      drift,
      isOverThreshold: Math.abs(drift) > t.driftThreshold,
    };
  });
}

/**
 * Load targets + summary and return drift items that exceed their threshold.
 * Used by the dashboard rebalance alert.
 */
export async function getRebalanceAlerts(
  userId: string,
  baseCurrency: string,
): Promise<AllocationDriftItem[]> {
  const [targets, summary] = await Promise.all([
    fetchUserAllocationTargets(userId),
    getCachedNetWorthSummary(userId, baseCurrency),
  ]);

  if (targets.length === 0) return [];

  const drift = computeAllocationDrift(targets, summary);
  return drift.filter((d) => d.isOverThreshold);
}
