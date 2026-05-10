import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { getAccountDetail, getAccountPriceMap } from "@/lib/services/account-service";
import { getSession } from "@/lib/auth-session";
import {
  getAllExchangeRates,
  resolveRate,
  resolveMissingRates,
} from "@/lib/services/exchange-rate-service";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import AccountDetailLoading from "./loading";

const CLIENT_NAMESPACES = ["accountDetail", "common", "categories", "transactionHistory"];

async function AccountDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Kick off independent queries before awaiting the account
  const ratesP = getAllExchangeRates();
  const messagesP = getMessages();
  const sessionP = getSession();

  const [session, allRatesMap, messages] = await Promise.all([sessionP, ratesP, messagesP]);

  const userId = session?.user?.id;
  if (!userId) notFound();

  const serialized = await getAccountDetail(userId, id);
  if (!serialized) notFound();

  const symbols = serialized.holdings.map((h) => h.symbol);
  const priceMap = await getAccountPriceMap(symbols);

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

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<AccountDetailLoading />}>
      <AccountDetailContent params={params} />
    </Suspense>
  );
}
