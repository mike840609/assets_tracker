import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "./exchange-rate-service";
import {
  serializeAccount,
  serializeHolding,
} from "@/lib/types";
import type { AccountWithValue, NetWorthSummary, HoldingWithPrice } from "@/lib/types";

/**
 * React-cached account + holdings fetcher.
 * Memoised per server render so concurrent calls with the same userId
 * (e.g. an early pre-fetch in DashboardContent and the later call inside
 * computeNetWorthSummary) share a single database round-trip.
 */
export const fetchUserAccountsWithHoldings = cache((userId: string) =>
  prisma.account.findMany({
    where: { userId, isActive: true },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  })
);

async function computeNetWorthSummary(
  userId: string,
  baseCurrency: string
): Promise<NetWorthSummary> {
  // Load accounts and exchange rates in parallel.
  // Both are React-cached, so if DashboardContent already fired these
  // calls without awaiting, we get the memoised results here for free.
  const [accounts, allRatesMap] = await Promise.all([
    fetchUserAccountsWithHoldings(userId),
    getAllExchangeRates(),
  ]);

  // Phase 2: fetch only the prices needed for this user's holdings
  const userSymbols = accounts.flatMap((a) => a.holdings.map((h) => h.symbol));
  const prices = await prisma.priceCache.findMany({
    where: userSymbols.length > 0 ? { symbol: { in: userSymbols } } : undefined,
  });

  const priceMap = Object.fromEntries(
    prices.map((p) => [p.symbol, { price: Number(p.price), currency: p.currency }])
  );

  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountsWithValue: AccountWithValue[] = [];

  // Collect missing rate pairs for batch-fetching
  const missingPairs = new Set<string>();

  for (const account of accounts) {
    // Try to resolve rate from bulk map first
    let rate = resolveRate(allRatesMap, account.currency, baseCurrency);
    if (rate === undefined) {
      missingPairs.add(`${account.currency}_${baseCurrency}`);
    }

    const cashBalance = Number(account.cashBalance);

    const holdingsWithPrice: HoldingWithPrice[] = account.holdings.map((h) => {
      const cached = priceMap[h.symbol];
      const currentPrice = cached?.price ?? null;
      const quantity = Number(h.quantity);
      const marketValue =
        currentPrice !== null ? currentPrice * quantity : null;
      return {
        ...serializeHolding(h),
        currentPrice,
        marketValue,
      };
    });

    for (const h of holdingsWithPrice) {
      if (h.marketValue !== null) {
        const holdingCurrency = h.currency || priceMap[h.symbol]?.currency || "USD";
        if (resolveRate(allRatesMap, holdingCurrency, baseCurrency) === undefined) {
          missingPairs.add(`${holdingCurrency}_${baseCurrency}`);
        }
        if (resolveRate(allRatesMap, holdingCurrency, account.currency) === undefined) {
          missingPairs.add(`${holdingCurrency}_${account.currency}`);
        }
      }
    }

    accountsWithValue.push({
      ...serializeAccount(account),
      holdings: holdingsWithPrice,
      totalValue: 0, // will be filled after missing rates are resolved
      totalValueInBaseCurrency: 0,
      _cashBalance: cashBalance,
      _currency: account.currency,
    } as AccountWithValue & { _cashBalance: number; _currency: string });
  }

  // Fetch any truly missing rates with timeout (defaults to 1 if APIs are slow)
  if (missingPairs.size > 0) {
    const pairs: Array<[string, string]> = [...missingPairs].map((key) => {
      const [from, to] = key.split("_");
      return [from, to];
    });
    const resolvedMap: Record<string, number> = {};
    await resolveMissingRates(pairs, resolvedMap);
    for (const [key, rate] of Object.entries(resolvedMap)) {
      allRatesMap.set(key, rate);
    }
  }

  // Helper using the now-complete map
  function getRate(from: string, to: string): number {
    return resolveRate(allRatesMap, from, to) ?? 1;
  }

  // Second pass: compute values using the complete rate map
  const exposureMap: Record<string, number> = {};

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const awv = accountsWithValue[i] as AccountWithValue & { _cashBalance: number; _currency: string };
    const rate = getRate(account.currency, baseCurrency);
    const cashBalance = awv._cashBalance;

    let holdingsInBase = 0;
    let holdingsInAccountCurrency = 0;
    for (const h of awv.holdings) {
      if (h.marketValue !== null) {
        const holdingCurrency = h.currency || priceMap[h.symbol]?.currency || "USD";
        const holdingRateToBase = getRate(holdingCurrency, baseCurrency);
        const valueInBase = h.marketValue * holdingRateToBase;
        holdingsInBase += valueInBase;
        const holdingRateToAccount = getRate(holdingCurrency, account.currency);
        holdingsInAccountCurrency += h.marketValue * holdingRateToAccount;

        if (account.type === "ASSET") {
          exposureMap[holdingCurrency] = (exposureMap[holdingCurrency] || 0) + valueInBase;
        }
      }
    }

    const cashInBase = cashBalance * rate;
    const totalValue = cashInBase + holdingsInBase;

    if (account.type === "ASSET" && cashBalance > 0) {
      exposureMap[account.currency] = (exposureMap[account.currency] || 0) + cashInBase;
    }

    awv.totalValue = cashBalance + holdingsInAccountCurrency;
    awv.totalValueInBaseCurrency = totalValue;

    // Clean up temporary fields
    delete (awv as any)._cashBalance;
    delete (awv as any)._currency;

    if (account.type === "ASSET") {
      totalAssets += totalValue;
    } else {
      totalLiabilities += totalValue;
    }
  }

  const currencyExposure = Object.entries(exposureMap)
    .map(([currency, value]) => ({ currency, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    baseCurrency,
    currencyExposure,
    accounts: accountsWithValue,
  };
}

/**
 * Cached version of net worth summary (5-minute TTL, invalidated by "net-worth" tag).
 * Used by the dashboard and accounts pages for fast repeated loads.
 * Invalidate explicitly via `revalidateTag("net-worth")` after price or data changes.
 */
export const getCachedNetWorthSummary = unstable_cache(
  computeNetWorthSummary,
  ["net-worth-summary"],
  { revalidate: 300, tags: ["net-worth"] }
);

/**
 * Alias kept for backward-compatibility with snapshot-service and other callers.
 * Routes that mutate data should call `revalidateTag("net-worth")` afterward so
 * the next dashboard load receives a fresh computation.
 */
export const getNetWorthSummary = getCachedNetWorthSummary;
