import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import type { SerializedAccountWithHoldings } from "@/lib/types";

export const getAccountDetail = cache(
  async (userId: string, accountId: string): Promise<SerializedAccountWithHoldings | null> => {
    const accounts = await fetchUserAccountsWithHoldings(userId);
    return accounts.find((account) => account.id === accountId) ?? null;
  },
);

const getAccountPriceMapForSymbolKey = cache(
  async (symbolsKey: string): Promise<Record<string, number>> => {
    const symbols = JSON.parse(symbolsKey) as string[];
    if (symbols.length === 0) return {};

    const cachedPrices = await prisma.priceCache.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, price: true },
    });

    return Object.fromEntries(cachedPrices.map((price) => [price.symbol, Number(price.price)]));
  },
);

export function getAccountPriceMap(symbols: string[]): Promise<Record<string, number>> {
  const stableSymbols = [...new Set(symbols)].sort();
  return getAccountPriceMapForSymbolKey(JSON.stringify(stableSymbols));
}
