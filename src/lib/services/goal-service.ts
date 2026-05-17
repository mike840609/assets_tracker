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
  cacheLife("minutes");
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return goals.map(serializeGoal);
}

export const fetchUserGoals = cache(fetchUserGoalsInner);

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

type SnapshotRow = { date: Date; netWorth: number; totalAssets: number };

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
    (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24),
  );

  let linearDate: string | null = null;
  let cagrDate: string | null = null;
  const today = new Date();

  const dailyChange = (lastValue - firstValue) / daysDiff;
  if (dailyChange > 0) {
    const daysToGoal = (targetAmountInBase - currentAmount) / dailyChange;
    const projected = new Date(today);
    projected.setDate(projected.getDate() + Math.ceil(daysToGoal));
    linearDate = projected.toISOString();
  }

  if (firstValue > 0 && lastValue > firstValue) {
    const annualRate = Math.pow(lastValue / firstValue, 365 / daysDiff) - 1;
    if (annualRate > 0 && currentAmount > 0) {
      const daysToGoal =
        (365 * Math.log(targetAmountInBase / currentAmount)) / Math.log(1 + annualRate);
      const projected = new Date(today);
      projected.setDate(projected.getDate() + Math.ceil(daysToGoal));
      cagrDate = projected.toISOString();
    }
  }

  return { linear: linearDate, cagr: cagrDate };
}

export async function computeGoalsWithProgress(
  userId: string,
  baseCurrency: string,
): Promise<GoalWithProgress[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [goals, summary, rateMap, rawSnapshots] = await Promise.all([
    fetchUserGoals(userId),
    getCachedNetWorthSummary(userId, baseCurrency),
    getAllExchangeRates(),
    prisma.netWorthSnapshot.findMany({
      where: { userId, baseCurrency, date: { gte: ninetyDaysAgo } },
      orderBy: { date: "asc" },
      select: { date: true, netWorth: true, totalAssets: true },
    }),
  ]);

  const snapshots: SnapshotRow[] = rawSnapshots.map((s) => ({
    date: s.date as Date,
    netWorth: Number(s.netWorth),
    totalAssets: Number(s.totalAssets),
  }));

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
