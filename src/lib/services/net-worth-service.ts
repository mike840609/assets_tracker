import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "./exchange-rate-service";
import {
  serializeAccount,
  serializeHolding,
} from "@/lib/types";
import type { AccountWithValue, NetWorthSummary, HoldingWithPrice } from "@/lib/types";

export interface NetWorthTotals {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  baseCurrency: string;
}

/**
 * Lightweight totals query for above-the-fold dashboard rendering.
 * Avoids building account-level breakdown payloads used by charts/tables.
 */
export async function getNetWorthTotals(
  userId: string,
  baseCurrency: string
): Promise<NetWorthTotals> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      type: true,
      currency: true,
      cashBalance: true,
      holdings: {
        where: { quantity: { gt: 0 } },
        select: { symbol: true, quantity: true, currency: true },
      },
    },
  });

  const symbols = [...new Set(accounts.flatMap((a) => a.holdings.map((h) => h.symbol)))];
  const accountCurrencies = accounts.map((a) => a.currency);
  const holdingCurrencies = accounts.flatMap((a) =>
    a.holdings.map((h) => h.currency).filter(Boolean) as string[]
  );
  const currencies = [...new Set([baseCurrency, ...accountCurrencies, ...holdingCurrencies])];

  const [prices, allRatesMap] = await Promise.all([
    symbols.length > 0
      ? prisma.priceCache.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, price: true, currency: true },
        })
      : Promise.resolve([]),
    getAllExchangeRates(),
  ]);

  const priceMap = Object.fromEntries(
    prices.map((p) => [p.symbol, { price: Number(p.price), currency: p.currency }])
  );

  const missingPairs = new Set<string>();
  for (const from of currencies) {
    if (resolveRate(allRatesMap, from, baseCurrency) === undefined) {
      missingPairs.add(`${from}_${baseCurrency}`);
    }
  }

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

  const getRate = (from: string, to: string) => resolveRate(allRatesMap, from, to) ?? 1;

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const account of accounts) {
    const accountRate = getRate(account.currency, baseCurrency);
    let totalValueInBase = Number(account.cashBalance) * accountRate;

    for (const h of account.holdings) {
      const priceEntry = priceMap[h.symbol];
      if (!priceEntry) continue;
      const holdingCurrency = h.currency || priceEntry.currency || "USD";
      const valueInHoldingCurrency = Number(priceEntry.price) * Number(h.quantity);
      totalValueInBase += valueInHoldingCurrency * getRate(holdingCurrency, baseCurrency);
    }

    if (account.type === "ASSET") totalAssets += totalValueInBase;
    else totalLiabilities += totalValueInBase;
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    baseCurrency,
  };
}

export async function getNetWorthSummary(
  userId: string,
  baseCurrency: string
): Promise<NetWorthSummary> {
  // Parallel: load accounts, prices, and all exchange rates in one go
  const [accounts, prices, allRatesMap] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isActive: true },
      include: { holdings: { where: { quantity: { gt: 0 } } } },
    }),
    prisma.priceCache.findMany(),
    getAllExchangeRates(),
  ]);

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
