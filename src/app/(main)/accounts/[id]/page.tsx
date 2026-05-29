import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { AccountsNavPanel } from "@/components/accounts/accounts-nav-panel";
import {
  resolveAccountDetail,
  resolveAccountPriceMap,
  resolveAccountsWithHoldings,
  resolveExchangeRatesMap,
} from "@/lib/services/demo-service";
import { getSession } from "@/lib/auth-session";
import { resolveRate } from "@/lib/services/exchange-rate-service";
import { log } from "@/lib/logger";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";

const CLIENT_NAMESPACES = ["accountDetail", "common", "categories", "transactionHistory"];

async function AccountDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Kick off independent queries before awaiting the account
  const ratesP = resolveExchangeRatesMap();
  const messagesP = getMessages();
  const sessionP = getSession();

  const [session, allRatesMap, messages] = await Promise.all([sessionP, ratesP, messagesP]);

  const userId = session?.user?.id;
  if (!userId) notFound();

  const [serialized, allAccounts] = await Promise.all([
    resolveAccountDetail(userId, id),
    resolveAccountsWithHoldings(userId),
  ]);
  if (!serialized) notFound();

  const symbols = serialized.holdings.map((h) => h.symbol);
  const priceMap = await resolveAccountPriceMap(symbols);

  // Build rates map from bulk-loaded data. Render path is read-only
  // against ExchangeRate — missing pairs fall back to 1 (rates are warmed
  // by the daily cron and on-write hooks).
  const ratesMap: Record<string, number> = {};
  const warnedPairs = new Set<string>();

  for (const holding of serialized.holdings) {
    const hc = holding.currency || "USD";
    if (hc === serialized.currency) continue;
    const key = `${hc}_${serialized.currency}`;
    if (ratesMap[key] !== undefined) continue;
    const rate = resolveRate(allRatesMap, hc, serialized.currency);
    if (rate !== undefined) {
      ratesMap[key] = rate;
      continue;
    }
    ratesMap[key] = 1;
    if (!warnedPairs.has(key)) {
      warnedPairs.add(key);
      log.warn("rates.unresolved", { from: hc, to: serialized.currency });
    }
  }

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="md:flex md:gap-6 md:items-start">
        <AccountsNavPanel accounts={allAccounts} currentId={id} />
        <div className="flex-1 min-w-0 space-y-6">
          <AccountDetail account={serialized} priceMap={priceMap} ratesMap={ratesMap} />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <AccountDetailContent params={params} />;
}
