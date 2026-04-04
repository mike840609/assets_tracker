import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate, getExchangeRate } from "./exchange-rate-service";
import {
  serializeAccount,
  serializeHolding,
} from "@/lib/types";
import type { AccountWithValue, NetWorthSummary, HoldingWithPrice } from "@/lib/types";

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

  // Fetch any truly missing rates in parallel (should be rare after initial setup)
  if (missingPairs.size > 0) {
    await Promise.all(
      [...missingPairs].map(async (key) => {
        const [from, to] = key.split("_");
        const rate = await getExchangeRate(from, to);
        allRatesMap.set(key, rate);
      })
    );
  }

  // Helper using the now-complete map
  function getRate(from: string, to: string): number {
    return resolveRate(allRatesMap, from, to) ?? 1;
  }

  // Second pass: compute values using the complete rate map
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
        holdingsInBase += h.marketValue * holdingRateToBase;
        const holdingRateToAccount = getRate(holdingCurrency, account.currency);
        holdingsInAccountCurrency += h.marketValue * holdingRateToAccount;
      }
    }

    const cashInBase = cashBalance * rate;
    const totalValue = cashInBase + holdingsInBase;

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

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    baseCurrency,
    accounts: accountsWithValue,
  };
}
