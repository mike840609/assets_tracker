import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCachedNetWorthSummary } from "./net-worth-service";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import { serializeGoal } from "@/lib/types";
import type { GoalWithProgress, NetWorthSummary, SerializedGoal } from "@/lib/types";

async function fetchUserGoalsInner(userId: string): Promise<SerializedGoal[]> {
  "use cache";
  cacheTag("goals");
  cacheTag(`goals:${userId}`);
  cacheLife("hours");
  const goals = await prisma.goal.findMany({
    where: { userId },
    // Manual order first; createdAt keeps a stable newest-first tiebreak for
    // goals that share a sortOrder (e.g. before the user has reordered).
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return goals.map(serializeGoal);
}

const fetchUserGoals = cache(fetchUserGoalsInner);

function getCurrentAmount(goal: SerializedGoal, summary: NetWorthSummary): number {
  switch (goal.scope) {
    case "NET_WORTH":
      return summary.netWorth;
    case "ASSETS_ONLY":
      return summary.totalAssets;
    case "CATEGORY": {
      const matching = summary.accounts.filter((a) => a.category === goal.scopeRefId);
      return matching.reduce((sum, a) => sum + a.totalValueInBaseCurrency, 0);
    }
    case "ACCOUNT": {
      const account = summary.accounts.find((a) => a.id === goal.scopeRefId);
      return account?.totalValueInBaseCurrency ?? 0;
    }
    default:
      return 0;
  }
}

type SnapshotRow = { date: string; netWorth: number; totalAssets: number };

// Cap ETA projections at ~100 years. A near-flat trend against a large
// remaining gap can make `daysToGoal` astronomically large — well beyond the
// JS Date range (±100,000,000 days from epoch) — so `Date.setDate()` would
// yield an Invalid Date and the subsequent `.toISOString()` throws a
// RangeError, 500ing /goals. Anything past this horizon is meaningless as a
// forecast anyway, so we return the existing "no projection" sentinel (null).
const MAX_PROJECTION_DAYS = 100 * 365;

/**
 * Project a date `daysFromToday` days into the future, returning `null` when
 * the horizon is not a sane, finite, in-range number of days. Shared by both
 * the linear and CAGR branches so the overflow guard can't drift between them.
 */
function projectDate(today: Date, daysFromToday: number): string | null {
  if (!Number.isFinite(daysFromToday) || daysFromToday < 0 || daysFromToday > MAX_PROJECTION_DAYS) {
    return null;
  }
  const projected = new Date(today);
  projected.setDate(projected.getDate() + Math.ceil(daysFromToday));
  return projected.toISOString();
}

/**
 * Cached 90-day snapshot window backing the goal projections. Was the only
 * uncached read on the dashboard's goals section; the cron / data import
 * revalidate `snapshots` + `history:${userId}` after every snapshot write.
 * The 90-day floor is captured at cache-fill time — same accepted drift as
 * getNormalizedHistory. Serialized shape (`"use cache"` can't carry
 * Prisma Decimal/Date).
 */
async function fetchRecentSnapshotsInner(
  userId: string,
  baseCurrency: string,
): Promise<SnapshotRow[]> {
  "use cache";
  cacheTag("snapshots");
  cacheTag(`history:${userId}`);
  cacheLife("hours");
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const rows = await prisma.netWorthSnapshot.findMany({
    where: { userId, baseCurrency, date: { gte: ninetyDaysAgo } },
    orderBy: { date: "asc" },
    select: { date: true, netWorth: true, totalAssets: true },
  });
  return rows.map((s) => ({
    date: s.date.toISOString(),
    netWorth: Number(s.netWorth),
    totalAssets: Number(s.totalAssets),
  }));
}

const fetchRecentSnapshots = cache(fetchRecentSnapshotsInner);

function computeProjection(
  goal: SerializedGoal,
  currentAmount: number,
  targetAmountInBase: number,
  snapshots: SnapshotRow[],
): { linear: string | null; cagr: string | null } {
  if (goal.scope !== "NET_WORTH" && goal.scope !== "ASSETS_ONLY") {
    return { linear: null, cagr: null };
  }
  if (currentAmount >= targetAmountInBase || snapshots.length < 2) {
    return { linear: null, cagr: null };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const firstValue = goal.scope === "NET_WORTH" ? first.netWorth : first.totalAssets;
  const lastValue = goal.scope === "NET_WORTH" ? last.netWorth : last.totalAssets;

  if (firstValue === lastValue) return { linear: null, cagr: null };

  const daysDiff = Math.max(
    1,
    (Date.parse(last.date) - Date.parse(first.date)) / (1000 * 60 * 60 * 24),
  );

  let linearDate: string | null = null;
  let cagrDate: string | null = null;
  const today = new Date();

  const dailyChange = (lastValue - firstValue) / daysDiff;
  if (dailyChange > 0) {
    const daysToGoal = (targetAmountInBase - currentAmount) / dailyChange;
    linearDate = projectDate(today, daysToGoal);
  }

  if (firstValue > 0 && lastValue > firstValue) {
    const annualRate = Math.pow(lastValue / firstValue, 365 / daysDiff) - 1;
    if (annualRate > 0 && currentAmount > 0) {
      const daysToGoal =
        (365 * Math.log(targetAmountInBase / currentAmount)) / Math.log(1 + annualRate);
      cagrDate = projectDate(today, daysToGoal);
    }
  }

  return { linear: linearDate, cagr: cagrDate };
}

export async function computeGoalsWithProgress(
  userId: string,
  baseCurrency: string,
): Promise<GoalWithProgress[]> {
  const [goals, summary, rateMap, snapshots] = await Promise.all([
    fetchUserGoals(userId),
    getCachedNetWorthSummary(userId, baseCurrency),
    getAllExchangeRates(),
    fetchRecentSnapshots(userId, baseCurrency),
  ]);

  return goals.map((goal) => {
    const currentAmount = getCurrentAmount(goal, summary);
    const exchangeRate = resolveRate(rateMap, goal.targetCurrency, baseCurrency) ?? 1;
    const targetAmountInBase = goal.targetAmount * exchangeRate;
    const progressPercent =
      targetAmountInBase > 0 ? Math.min(100, (currentAmount / targetAmountInBase) * 100) : 0;
    const isCompleted = progressPercent >= 100;
    const { linear, cagr } = computeProjection(goal, currentAmount, targetAmountInBase, snapshots);

    return {
      goal,
      currentAmount,
      targetAmountInBase,
      progressPercent,
      projectedDateLinear: linear,
      projectedDateCAGR: cagr,
      isCompleted,
    };
  });
}
