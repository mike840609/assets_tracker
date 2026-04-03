import { prisma } from "@/lib/prisma";
import { AccountsList } from "@/components/accounts/accounts-list";
import { serializeAccountWithHoldings } from "@/lib/types";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    include: { holdings: true },
    orderBy: { createdAt: "desc" },
  });

  // Get all unique symbols from holdings
  const allHoldings = accounts.flatMap((a) => a.holdings);
  const allSymbols = [...new Set(allHoldings.map((h) => h.symbol))];

  // Fetch cached prices
  const cachedPrices = await prisma.priceCache.findMany({
    where: { symbol: { in: allSymbols } },
  });
  const priceMap: Record<string, number> = Object.fromEntries(
    cachedPrices.map((p) => [p.symbol, Number(p.price)])
  );

  // Fetch live prices for any uncached symbols
  const uncachedHoldings = allHoldings.filter((h) => !(h.symbol in priceMap));
  if (uncachedHoldings.length > 0) {
    const uncachedSymbols = [...new Set(uncachedHoldings.map((h) => h.symbol))];
    const stockSymbols = uncachedSymbols.filter((s) => {
      const h = allHoldings.find((h) => h.symbol === s);
      return h && ["STOCK", "ETF", "MUTUAL_FUND", "BOND"].includes(h.assetType);
    });
    const cryptoSymbols = uncachedSymbols.filter((s) => {
      const h = allHoldings.find((h) => h.symbol === s);
      return h?.assetType === "CRYPTO";
    });

    const [stockPrices, cryptoPrices] = await Promise.all([
      fetchStockPrices(stockSymbols),
      fetchCryptoPrices(cryptoSymbols),
    ]);

    const allFetched = new Map([...stockPrices, ...cryptoPrices]);
    for (const [symbol, { price, currency }] of allFetched) {
      priceMap[symbol] = price;
      await prisma.priceCache.upsert({
        where: { symbol },
        update: { price, currency, updatedAt: new Date() },
        create: { symbol, price, currency },
      });
    }
  }

  const serialized = accounts.map(serializeAccountWithHoldings);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
      <AccountsList accounts={serialized} priceMap={priceMap} />
    </div>
  );
}

