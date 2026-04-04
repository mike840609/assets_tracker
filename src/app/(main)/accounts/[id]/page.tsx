import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { serializeAccountWithHoldings } from "@/lib/types";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { getExchangeRate } from "@/lib/services/exchange-rate-service";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  });

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

    for (const [symbol, { price, currency }] of allFetched) {
      priceMap[symbol] = price;
      // Cache for future use
      await prisma.priceCache.upsert({
        where: { symbol },
        update: { price, currency, updatedAt: new Date() },
        create: { symbol, price, currency },
      });
    }
  }

  const serialized = serializeAccountWithHoldings(account);

  const ratesMap: Record<string, number> = {};
  for (const holding of serialized.holdings) {
    const hc = holding.currency || "USD";
    if (hc !== serialized.currency) {
      const key = `${hc}_${serialized.currency}`;
      if (ratesMap[key] === undefined) {
        ratesMap[key] = await getExchangeRate(hc, serialized.currency);
      }
    }
  }

  return (
    <div className="space-y-6">
      <AccountDetail account={serialized} priceMap={priceMap} ratesMap={ratesMap} />
    </div>
  );
}

