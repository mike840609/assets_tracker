import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { serializeAccountWithHoldings } from "@/lib/types";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "@/lib/services/exchange-rate-service";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";

const CLIENT_NAMESPACES = ["accountDetail", "common", "categories"];

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Parallel: load account, cached prices, exchange rates, and messages at once
  const [account, allRatesMap, cachedPrices, messages] = await Promise.all([
    prisma.account.findUnique({
      where: { id },
      include: { holdings: { where: { quantity: { gt: 0 } } } },
    }),
    getAllExchangeRates(),
    prisma.priceCache.findMany(),
    getMessages(),
  ]);

  if (!account) notFound();

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
