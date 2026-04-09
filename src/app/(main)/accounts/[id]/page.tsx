import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { serializeAccountWithHoldings } from "@/lib/types";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "@/lib/services/exchange-rate-service";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";

const CLIENT_NAMESPACES = ["accountDetail", "common", "categories", "transactionHistory"];

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch account first to know which symbols to filter prices by
  const account = await prisma.account.findUnique({
    where: { id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  });

  if (!account) notFound();

  const symbols = account.holdings.map((h) => h.symbol);

  // Parallel: load filtered prices, exchange rates, and messages
  const [allRatesMap, cachedPrices, messages] = await Promise.all([
    getAllExchangeRates(),
    prisma.priceCache.findMany({ where: { symbol: { in: symbols } } }),
    getMessages(),
  ]);

  const priceMap = Object.fromEntries(
    cachedPrices.map((p) => [p.symbol, Number(p.price)])
  );

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
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-6">
        <AccountDetail account={serialized} priceMap={priceMap} ratesMap={ratesMap} />
      </div>
    </NextIntlClientProvider>
  );
}
