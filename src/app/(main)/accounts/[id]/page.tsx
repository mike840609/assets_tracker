import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { serializeAccountWithHoldings } from "@/lib/types";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "@/lib/services/exchange-rate-service";
import { Suspense } from "react";
import { AccountDetailSkeleton } from "@/components/accounts/account-detail-skeleton";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // We fetch the basic account info first to check if it exists
  const account = await prisma.account.findUnique({
    where: { id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  });

  if (!account) notFound();

  const serialized = serializeAccountWithHoldings(account);

  return (
    <Suspense fallback={<AccountDetailSkeleton />}>
      <AccountDetailDataLoader account={serialized} id={id} />
    </Suspense>
  );
}

async function AccountDetailDataLoader({ 
  account, 
  id 
}: { 
  account: ReturnType<typeof serializeAccountWithHoldings>;
  id: string;
}) {
  // Parallel: all exchange rates
  const allRatesMap = await getAllExchangeRates();

  // Get cached prices
  const cachedPrices = await prisma.priceCache.findMany({
    where: {
      symbol: { in: account.holdings.map((h) => h.symbol) },
    },
  });

  const priceMap: Record<string, number> = Object.fromEntries(
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

  // Build rates map from bulk-loaded data
  const ratesMap: Record<string, number> = {};
  const missingPairs: Array<[string, string]> = [];

  for (const holding of account.holdings) {
    const hc = holding.currency || "USD";
    if (hc !== account.currency) {
      const key = `${hc}_${account.currency}`;
      if (ratesMap[key] === undefined) {
        const rate = resolveRate(allRatesMap, hc, account.currency);
        if (rate !== undefined) {
          ratesMap[key] = rate;
        } else {
          missingPairs.push([hc, account.currency]);
        }
      }
    }
  }

  // Resolve missing pairs with timeout (defaults to 1 if APIs are slow)
  await resolveMissingRates(missingPairs, ratesMap);

  return (
    <div className="space-y-6">
      <AccountDetail account={account} priceMap={priceMap} ratesMap={ratesMap} />
    </div>
  );
}
