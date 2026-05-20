import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AccountsList } from "@/components/accounts/accounts-list";
import { getAllExchangeRates, resolveRate } from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import {
  fetchUserAccountsWithHoldings,
  fetchUserArchivedAccountsWithHoldings,
} from "@/lib/services/net-worth-service";
import { getCachedPricesForSymbols } from "@/lib/services/price-service";
import { log } from "@/lib/logger";
import AccountsLoading from "./loading";

const CLIENT_NAMESPACES = [
  "accountsList",
  "accountForm",
  "quickAddHolding",
  "categories",
  "common",
];

async function AccountsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  // Run all independent queries in parallel (translations + data)
  const [t, messages, accounts, archivedAccounts, settings, allRatesMap] = await Promise.all([
    getTranslations("accounts"),
    getMessages(),
    fetchUserAccountsWithHoldings(userId),
    fetchUserArchivedAccountsWithHoldings(userId),
    getOrCreateSettings(userId),
    getAllExchangeRates(),
  ]);

  const baseCurrency = settings.baseCurrency;

  // Fetch cached prices for this user's holding symbols only
  const allSymbols = [...new Set(accounts.flatMap((a) => a.holdings.map((h) => h.symbol)))];
  const cachedPrices = await getCachedPricesForSymbols(allSymbols);
  const priceMap: Record<string, number> = Object.fromEntries(
    cachedPrices.map((p) => [p.symbol, p.price]),
  );

  // Build rates map from the bulk-loaded rates. Render path is read-only
  // against ExchangeRate — missing pairs fall back to 1 (rates are warmed
  // by the daily cron and on-write hooks).
  const ratesMap: Record<string, number> = {};
  const warnedPairs = new Set<string>();
  const fillRate = (from: string, to: string) => {
    const key = `${from}_${to}`;
    if (ratesMap[key] !== undefined) return;
    const rate = resolveRate(allRatesMap, from, to);
    if (rate !== undefined) {
      ratesMap[key] = rate;
      return;
    }
    ratesMap[key] = 1;
    if (!warnedPairs.has(key)) {
      warnedPairs.add(key);
      log.warn("rates.unresolved", { from, to });
    }
  };

  for (const account of accounts) {
    if (account.currency !== baseCurrency) {
      fillRate(account.currency, baseCurrency);
    }
    for (const holding of account.holdings) {
      const hc = holding.currency || "USD";
      if (hc !== account.currency) {
        fillRate(hc, account.currency);
      }
    }
  }

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>
        <AccountsList
          accounts={accounts}
          archivedAccounts={archivedAccounts}
          priceMap={priceMap}
          ratesMap={ratesMap}
          baseCurrency={baseCurrency}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<AccountsLoading />}>
      <AccountsContent />
    </Suspense>
  );
}
