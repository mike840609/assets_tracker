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
    prices.map((p) => [p.symbol, Number(p.price)])
  );

  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountsWithValue: AccountWithValue[] = [];

  for (const account of accounts) {
    const rate = await getExchangeRate(account.currency, baseCurrency);
    const cashBalance = Number(account.cashBalance);

    const holdingsWithPrice: HoldingWithPrice[] = account.holdings.map((h) => {
      const currentPrice = priceMap[h.symbol] ?? null;
      const quantity = Number(h.quantity);
      const marketValue =
        currentPrice !== null ? currentPrice * quantity : null;
      return {
        ...serializeHolding(h),
        currentPrice,
        marketValue,
      };
    });

    const holdingsValue = holdingsWithPrice.reduce(
      (sum, h) => sum + (h.marketValue ?? 0),
      0
    );

    // Cash balance is in account's currency, holdings value is in USD (from price feeds)
    const cashInBase = cashBalance * rate;
    const holdingsInBase =
      account.currency === "USD"
        ? holdingsValue * rate
        : holdingsValue * (await getExchangeRate("USD", baseCurrency));

    const totalValue = cashInBase + holdingsInBase;

    accountsWithValue.push({
      ...serializeAccount(account),
      holdings: holdingsWithPrice,
      totalValue: cashBalance + holdingsValue,
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
