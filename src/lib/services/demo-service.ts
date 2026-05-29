import "server-only";
import { cookies } from "next/headers";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import {
  computeSummaryFromData,
  fetchUserAccountsWithHoldings,
  fetchUserArchivedAccountsWithHoldings,
  getCachedNetWorthSummary,
} from "./net-worth-service";
import { getAccountDetail, getAccountPriceMap } from "./account-service";
import { getNormalizedHistory, getFullNormalizedHistory } from "./history-service";
import { getCachedAnalysisPayload, type AnalysisPayload } from "./analysis-payload-service";
import { getProjectionData, type ProjectionData } from "./projection-service";
import { getCachedPricesForSymbols } from "./price-service";
import {
  DEMO_ACCOUNTS,
  DEMO_ACCOUNT_META,
  DEMO_EXCHANGE_RATES,
  DEMO_PRICE_MAP,
  getDemoAccountCashFlowUSD,
  getDemoHistory,
} from "@/lib/demo/demo-data";
import type { NetWorthSummary, SerializedAccountWithHoldings } from "@/lib/types";
import type {
  NormalizedSnapshot,
  RawHistoryData,
  SnapshotBreakdown,
  AccountMeta,
  AccountMonthlyContribution,
} from "./history-service";
import type { MonthlyContribution } from "./analysis-service";

/** Cookie name for the read-only demo overlay. Presence (= "1") enables it. */
export const DEMO_COOKIE = "demo_mode";

/**
 * Whether the current request is in demo mode. Reads a cookie, so it MUST be
 * called outside any `"use cache"` scope (cacheComponents forbids cookie reads
 * inside cached functions). All `resolve*` helpers below branch on this before
 * touching the cached, DB-backed fetchers.
 */
export async function isDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}

// ---------------------------------------------------------------------------
// Demo data builders (pure; convert canonical USD fixtures → base currency)
// ---------------------------------------------------------------------------

function usdToBase(baseCurrency: string): number {
  return resolveRate(DEMO_EXCHANGE_RATES, "USD", baseCurrency) ?? 1;
}

function getDemoNetWorthSummary(baseCurrency: string): NetWorthSummary {
  return computeSummaryFromData(DEMO_ACCOUNTS, DEMO_EXCHANGE_RATES, DEMO_PRICE_MAP, baseCurrency);
}

function getDemoNormalizedHistory(baseCurrency: string, days?: number): NormalizedSnapshot[] {
  const rate = usdToBase(baseCurrency);
  let history = getDemoHistory();
  if (days !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    history = history.filter((s) => s.date >= cutoffStr);
  }
  return history.map((s) => ({
    id: `demo-snap-${s.date}`,
    date: s.date,
    createdAt: s.createdAt,
    netWorth: s.netWorthUSD * rate,
    totalAssets: s.totalAssetsUSD * rate,
    totalLiabilities: s.totalLiabilitiesUSD * rate,
    baseCurrency,
  }));
}

function getDemoRawHistory(baseCurrency: string): RawHistoryData {
  const rate = usdToBase(baseCurrency);
  const snapshots: SnapshotBreakdown[] = getDemoHistory().map((s) => {
    const accountValues: Record<string, number> = {};
    for (const [id, v] of Object.entries(s.perAccountUSD)) {
      accountValues[id] = v * rate;
    }
    return { date: s.date, accountValues };
  });
  const accounts: AccountMeta[] = DEMO_ACCOUNT_META.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
  }));
  return { snapshots, accounts };
}

function getDemoAccountMonthlyCashFlow(baseCurrency: string): AccountMonthlyContribution[] {
  const rate = usdToBase(baseCurrency);
  return getDemoAccountCashFlowUSD().map((c) => ({
    accountId: c.accountId,
    monthKey: c.monthKey,
    contributions: c.contributions * rate,
  }));
}

function getDemoMonthlyCashFlow(baseCurrency: string): MonthlyContribution[] {
  const byMonth = new Map<string, number>();
  for (const c of getDemoAccountMonthlyCashFlow(baseCurrency)) {
    byMonth.set(c.monthKey, (byMonth.get(c.monthKey) ?? 0) + c.contributions);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, contributions]) => ({ monthKey, contributions }));
}

function getDemoAnalysisPayload(baseCurrency: string): AnalysisPayload {
  return {
    snapshots: getDemoNormalizedHistory(baseCurrency),
    cashFlowData: getDemoMonthlyCashFlow(baseCurrency),
    rawHistory: getDemoRawHistory(baseCurrency),
    accountCashFlow: getDemoAccountMonthlyCashFlow(baseCurrency),
  };
}

function getDemoProjectionData(baseCurrency: string): ProjectionData {
  const history = getDemoNormalizedHistory(baseCurrency);
  if (history.length === 0) {
    return { latestNetWorth: 0, trailing12mSavings: 0, annualSnapshots: [], hasData: false };
  }
  const latestNetWorth = history[history.length - 1].netWorth;
  const byYear = new Map<number, number>();
  for (const s of history) {
    byYear.set(Number(s.date.slice(0, 4)), s.netWorth);
  }
  const annualSnapshots = Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, netWorth]) => ({ year, netWorth }));

  const trailing12mSavings = getDemoMonthlyCashFlow(baseCurrency).reduce(
    (sum, c) => sum + c.contributions,
    0,
  );

  return { latestNetWorth, trailing12mSavings, annualSnapshots, hasData: true };
}

/** Demo equivalent of the dashboard's "previous snapshot" delta source. */
export interface DemoPreviousSnapshot {
  date: string;
  createdAt: string;
  netWorth: number;
  baseCurrency: string;
}

// ---------------------------------------------------------------------------
// Resolvers — call these from pages instead of the raw fetchers. Each one
// returns demo data when the cookie is set, otherwise delegates to the real
// (cached, DB-backed) read.
// ---------------------------------------------------------------------------

export async function resolveNetWorthSummary(
  userId: string,
  baseCurrency: string,
): Promise<NetWorthSummary> {
  if (await isDemoMode()) return getDemoNetWorthSummary(baseCurrency);
  return getCachedNetWorthSummary(userId, baseCurrency);
}

export async function resolveAccountsWithHoldings(
  userId: string,
): Promise<SerializedAccountWithHoldings[]> {
  if (await isDemoMode()) return DEMO_ACCOUNTS;
  return fetchUserAccountsWithHoldings(userId);
}

export async function resolveArchivedAccountsWithHoldings(
  userId: string,
): Promise<SerializedAccountWithHoldings[]> {
  if (await isDemoMode()) return [];
  return fetchUserArchivedAccountsWithHoldings(userId);
}

export async function resolveNormalizedHistory(
  userId: string,
  baseCurrency: string,
): Promise<NormalizedSnapshot[]> {
  if (await isDemoMode()) return getDemoNormalizedHistory(baseCurrency, 90);
  return getNormalizedHistory(userId, baseCurrency);
}

export async function resolveFullNormalizedHistory(
  userId: string,
  baseCurrency: string,
): Promise<NormalizedSnapshot[]> {
  if (await isDemoMode()) return getDemoNormalizedHistory(baseCurrency);
  return getFullNormalizedHistory(userId, baseCurrency);
}

export async function resolveAccountCount(userId: string): Promise<number> {
  if (await isDemoMode()) return DEMO_ACCOUNTS.length;
  const { prisma } = await import("@/lib/prisma");
  return prisma.account.count({ where: { userId, isActive: true } });
}

export async function resolveAccountDetail(
  userId: string,
  accountId: string,
): Promise<SerializedAccountWithHoldings | null> {
  if (await isDemoMode()) return DEMO_ACCOUNTS.find((a) => a.id === accountId) ?? null;
  return getAccountDetail(userId, accountId);
}

export async function resolveAccountPriceMap(symbols: string[]): Promise<Record<string, number>> {
  if (await isDemoMode()) {
    const out: Record<string, number> = {};
    for (const s of symbols) {
      const px = DEMO_PRICE_MAP[s];
      if (px) out[s] = px.price;
    }
    return out;
  }
  return getAccountPriceMap(symbols);
}

export async function resolveCachedPricesForSymbols(
  symbols: string[],
): Promise<{ symbol: string; price: number; currency: string }[]> {
  if (await isDemoMode()) {
    return symbols
      .filter((s) => DEMO_PRICE_MAP[s])
      .map((s) => ({
        symbol: s,
        price: DEMO_PRICE_MAP[s].price,
        currency: DEMO_PRICE_MAP[s].currency,
      }));
  }
  return getCachedPricesForSymbols(symbols);
}

export async function resolveExchangeRatesMap(): Promise<Map<string, number>> {
  if (await isDemoMode()) return DEMO_EXCHANGE_RATES;
  return getAllExchangeRates();
}

export async function resolveAnalysisPayload(
  userId: string,
  baseCurrency: string,
): Promise<AnalysisPayload> {
  if (await isDemoMode()) return getDemoAnalysisPayload(baseCurrency);
  return getCachedAnalysisPayload(userId, baseCurrency);
}

export async function resolveProjectionData(
  userId: string,
  baseCurrency: string,
): Promise<ProjectionData> {
  if (await isDemoMode()) return getDemoProjectionData(baseCurrency);
  return getProjectionData(userId, baseCurrency);
}

/** Demo previous-snapshot meta (2nd-to-last point) for the dashboard delta. */
export function getDemoPreviousSnapshot(baseCurrency: string): DemoPreviousSnapshot | null {
  const history = getDemoNormalizedHistory(baseCurrency);
  if (history.length < 2) return null;
  const prev = history[history.length - 2];
  return {
    date: prev.date,
    createdAt: prev.createdAt,
    netWorth: prev.netWorth,
    baseCurrency,
  };
}
