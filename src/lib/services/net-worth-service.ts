import { prisma } from "@/lib/prisma";
import { getExchangeRate } from "./exchange-rate-service";
import {
  serializeAccount,
  serializeHolding,
} from "@/lib/types";
import type { AccountWithValue, NetWorthSummary, HoldingWithPrice } from "@/lib/types";

export async function getNetWorthSummary(
  baseCurrency: string
): Promise<NetWorthSummary> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { holdings: true },
  });

  const prices = await prisma.priceCache.findMany();
  const priceMap = Object.fromEntries(
    prices.map((p) => [p.symbol, { price: Number(p.price), currency: p.currency }])
  );

  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountsWithValue: AccountWithValue[] = [];

  for (const account of accounts) {
    const rate = await getExchangeRate(account.currency, baseCurrency);
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

    // Convert each holding's market value from its native currency to base currency
    // AND to the account's local currency
    let holdingsInBase = 0;
    let holdingsInAccountCurrency = 0;
    for (const h of holdingsWithPrice) {
      if (h.marketValue !== null) {
        // Use the holding's currency, fall back to PriceCache currency, then USD
        const holdingCurrency = h.currency || priceMap[h.symbol]?.currency || "USD";
        
        const holdingRateToBase = await getExchangeRate(holdingCurrency, baseCurrency);
        holdingsInBase += h.marketValue * holdingRateToBase;
        
        const holdingRateToAccount = await getExchangeRate(holdingCurrency, account.currency);
        holdingsInAccountCurrency += h.marketValue * holdingRateToAccount;
      }
    }

    const cashInBase = cashBalance * rate;
    const totalValue = cashInBase + holdingsInBase;

    accountsWithValue.push({
      ...serializeAccount(account),
      holdings: holdingsWithPrice,
      totalValue: cashBalance + holdingsInAccountCurrency,
      totalValueInBaseCurrency: totalValue,
    });

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

