import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { serializeAccountWithHoldings } from "@/lib/types";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "@/lib/services/exchange-rate-service";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Parallel: load account + all exchange rates at once
  const [account, allRatesMap] = await Promise.all([
    prisma.account.findUnique({
      where: { id },
      include: { holdings: { where: { quantity: { gt: 0 } } } },
    }),
    getAllExchangeRates(),
  ]);

  if (!account) notFound();

  // Get cached prices
  const cachedPrices = await prisma.priceCache.findMany({
    where: {
      symbol: { in: account.holdings.map((h) => h.symbol) },
    },
  });

  const priceMap = Object.fromEntries(
    cachedPrices.map((p) => [p.symbol, Number(p.price)])
  );

  // Find holdings with missing prices and fetch them live
  const missingSymbols = account.holdings.filter((h) => !(h.symbol in priceMap));
  if (missingSymbols.length > 0) {
    const stockSymbols = missingSymbols
      .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND"].includes(h.assetType))
      .map((h) => h.symbol);
    const cryptoSymbols = missingSymbols
      .filter((h) => h.assetType === "CRYPTO")
      .map((h) => h.symbol);

    const [stockPrices, cryptoPrices] = await Promise.all([
      fetchStockPrices(stockSymbols),
      fetchCryptoPrices(cryptoSymbols),
    ]);

    const allFetched = new Map([...stockPrices, ...cryptoPrices]);

    // Batch upsert concurrently
    const upsertPromises = [];
    for (const [symbol, { price, currency }] of allFetched) {
      priceMap[symbol] = price;
      upsertPromises.push(
        prisma.priceCache.upsert({
          where: { symbol },
          update: { price, currency, updatedAt: new Date() },
          create: { symbol, price, currency },
        })
      );
    }
    await Promise.all(upsertPromises);
  }

  const serialized = serializeAccountWithHoldings(account);

  // Build rates map from bulk-loaded data
  const ratesMap: Record<string, number> = {};
  const missingPairs: Array<[string, string]> = [];

  for (const holding of serialized.holdings) {
    const hc = holding.currency || "USD";
    if (hc !== serialized.currency) {
      const key = `${hc}_${serialized.currency}`;
      if (ratesMap[key] === undefined) {
        const rate = resolveRate(allRatesMap, hc, serialized.currency);
        if (rate !== undefined) {
          ratesMap[key] = rate;
        } else {
          missingPairs.push([hc, serialized.currency]);
        }
      }
    }
  }

  // Resolve missing pairs with timeout (defaults to 1 if APIs are slow)
  await resolveMissingRates(missingPairs, ratesMap);

  return (
    <div className="space-y-6">
      <AccountDetail account={serialized} priceMap={priceMap} ratesMap={ratesMap} />
    </div>
  );
}
