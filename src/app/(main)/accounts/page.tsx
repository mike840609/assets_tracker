import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AccountsList } from "@/components/accounts/accounts-list";
import {
  getAllExchangeRates,
  resolveRate,
  resolveMissingRates,
} from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import { getCachedPricesForSymbols } from "@/lib/services/price-service";
import AccountsLoading from "./loading";

const CLIENT_NAMESPACES = ["accountsList", "accountForm", "quickAddHolding", "categories"];

async function AccountsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  // Run all independent queries in parallel (translations + data)
  const [t, messages, accounts, settings, allRatesMap] = await Promise.all([
    getTranslations("accounts"),
    getMessages(),
    fetchUserAccountsWithHoldings(userId),
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

  // Build rates map from the bulk-loaded rates (no sequential DB calls!)
  const ratesMap: Record<string, number> = {};
  const missingPairs: Array<[string, string]> = [];

  for (const account of accounts) {
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
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>
        <AccountsList
          accounts={accounts}
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
