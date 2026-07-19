import "server-only";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import {
  computeRemainingCostBasis,
  type InvestmentCostBasisSummary,
} from "@/lib/services/analysis-service";

export async function getInvestmentCostBasisSummary(
  userId: string,
  baseCurrency: string,
): Promise<InvestmentCostBasisSummary> {
  const [accounts, allRatesMap] = await Promise.all([
    prisma.account.findMany({
      where: {
        userId,
        isActive: true,
        category: { in: ["BROKERAGE", "CRYPTO_WALLET"] },
      },
      select: {
        currency: true,
        holdings: {
          where: { quantity: { gt: 0 } },
          select: {
            symbol: true,
            quantity: true,
            currency: true,
            assetType: true,
            contractMultiplier: true,
            transactions: {
              select: {
                id: true,
                type: true,
                quantity: true,
                unitPrice: true,
                createdAt: true,
                occurrenceDate: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
    getAllExchangeRates(),
  ]);

  const symbols = accounts.flatMap((account) => account.holdings.map((holding) => holding.symbol));
  const prices =
    symbols.length > 0
      ? await prisma.priceCache.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, price: true, currency: true },
        })
      : [];
  const priceMap = new Map(
    prices.map((price) => [price.symbol, { price: Number(price.price), currency: price.currency }]),
  );

  let marketValue = 0;
  let costBasis = 0;
  let pricedHoldingCount = 0;
  let costedHoldingCount = 0;

  for (const account of accounts) {
    for (const holding of account.holdings) {
      const cached = priceMap.get(holding.symbol);
      if (!cached) continue;

      const multiplier = holding.assetType === "OPTION" ? (holding.contractMultiplier ?? 100) : 1;
      // The cached price's own currency is the truth for valuing that price —
      // same precedence as net-worth-service (see its comment at the
      // marketValue conversion). The holding's stored currency still governs
      // the cost-basis leg, because transaction unit prices are denominated
      // in it.
      const priceCurrency = cached.currency || holding.currency || account.currency;
      const priceRate = resolveRate(allRatesMap, priceCurrency, baseCurrency) ?? 1;
      const quantity = Number(holding.quantity);
      const holdingMarketValue = Number(cached.price) * quantity * multiplier * priceRate;
      marketValue += holdingMarketValue;
      pricedHoldingCount += 1;

      const costCurrency = holding.currency || priceCurrency;
      const costRate = resolveRate(allRatesMap, costCurrency, baseCurrency) ?? 1;

      const position = computeRemainingCostBasis(
        holding.transactions
          .slice()
          .sort((a, b) => {
            const byEffective =
              (a.occurrenceDate ?? a.createdAt).getTime() -
              (b.occurrenceDate ?? b.createdAt).getTime();
            if (byEffective !== 0) return byEffective;
            const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
            if (byCreated !== 0) return byCreated;
            return a.id.localeCompare(b.id);
          })
          .map((tx) => ({
            type: tx.type,
            quantity: Number(tx.quantity),
            unitPrice: tx.unitPrice == null ? null : Number(tx.unitPrice) * multiplier,
          })),
      );
      if (position.hasCostBasis) {
        costBasis += position.costBasis * costRate;
        costedHoldingCount += 1;
      }
    }
  }

  const unrealizedGain = costBasis > 0 ? marketValue - costBasis : null;
  return {
    marketValue,
    costBasis,
    unrealizedGain,
    unrealizedGainPct: unrealizedGain == null ? null : unrealizedGain / costBasis,
    pricedHoldingCount,
    costedHoldingCount,
  };
}
