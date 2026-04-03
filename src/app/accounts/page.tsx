import { prisma } from "@/lib/prisma";
import { AccountsList } from "@/components/accounts/accounts-list";
import { serializeAccountWithHoldings } from "@/lib/types";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { getExchangeRate } from "@/lib/services/exchange-rate-service";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    include: { holdings: { where: { quantity: { gt: 0 } } } },
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

  // Fetch base currency from settings
  const settings = await prisma.setting.findUnique({ where: { id: "app_settings" } });
  const baseCurrency = settings?.baseCurrency ?? "USD";

  const ratesMap: Record<string, number> = {};
  for (const account of serialized) {
    // Rate from account currency to base currency (for category totals)
    if (account.currency !== baseCurrency) {
      const key = `${account.currency}_${baseCurrency}`;
      if (ratesMap[key] === undefined) {
        ratesMap[key] = await getExchangeRate(account.currency, baseCurrency);
      }
    }
    for (const holding of account.holdings) {
      const hc = holding.currency || "USD";
      if (hc !== account.currency) {
        const key = `${hc}_${account.currency}`;
        if (ratesMap[key] === undefined) {
          ratesMap[key] = await getExchangeRate(hc, account.currency);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
      <AccountsList accounts={serialized} priceMap={priceMap} ratesMap={ratesMap} baseCurrency={baseCurrency} />
    </div>
  );
}

