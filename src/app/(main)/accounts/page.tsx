import { getSession } from "@/lib/auth-session";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { prisma } from "@/lib/prisma";
import { AccountsList } from "@/components/accounts/accounts-list";
import { serializeAccountWithHoldings } from "@/lib/types";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "@/lib/services/exchange-rate-service";

const CLIENT_NAMESPACES = [
  "accountsList",
  "accountForm",
  "quickAddHolding",
  "categories",
];

export default async function AccountsPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [t, messages] = await Promise.all([
    getTranslations("accounts"),
    getMessages(),
  ]);

  // Parallel: fetch accounts + settings + all exchange rates at once
  const [accountsRaw, settings, allRatesMap] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      include: { holdings: { where: { quantity: { gt: 0 } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.setting.findUnique({ where: { userId } }),
    getAllExchangeRates(),
  ]);

  const baseCurrency = settings?.baseCurrency ?? "USD";

  // Get all unique symbols from holdings
  const allHoldings = accountsRaw.flatMap((a) => a.holdings);
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
    // Batch upsert — run concurrently
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

  const serialized = accountsRaw.map(serializeAccountWithHoldings);

  // Build rates map from the bulk-loaded rates (no sequential DB calls!)
  const ratesMap: Record<string, number> = {};
  const missingPairs: Array<[string, string]> = [];

  for (const account of serialized) {
    if (account.currency !== baseCurrency) {
      const key = `${account.currency}_${baseCurrency}`;
      const rate = resolveRate(allRatesMap, account.currency, baseCurrency);
      if (rate !== undefined) {
        ratesMap[key] = rate;
      } else {
        missingPairs.push([account.currency, baseCurrency]);
      }
    }
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
  }

  // Resolve missing pairs with timeout (defaults to 1 if APIs are slow)
  await resolveMissingRates(missingPairs, ratesMap);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <AccountsList accounts={serialized} priceMap={priceMap} ratesMap={ratesMap} baseCurrency={baseCurrency} />
      </div>
    </NextIntlClientProvider>
  );
}
