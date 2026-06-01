import { getSession } from "@/lib/auth-session";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AccountsList } from "@/components/accounts/accounts-list";
import { PortfolioHeatmap } from "@/components/analysis/portfolio-heatmap";
import { getAllExchangeRates, resolveRate } from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import {
  fetchUserAccountsWithHoldings,
  fetchUserArchivedAccountsWithHoldings,
  getCachedNetWorthSummary,
} from "@/lib/services/net-worth-service";
import { getCachedPricesForSymbols } from "@/lib/services/price-service";
import { log } from "@/lib/logger";

const CLIENT_NAMESPACES = [
  "accountsList",
  "accountForm",
  "quickAddHolding",
  "holdingSearch",
  "categories",
  "common",
  "analysis",
];

async function AccountsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  // Run all independent queries in parallel (translations + data). The net-worth
  // summary that backs the heatmap depends on the base currency, so it chains off
  // the settings read rather than blocking the whole batch.
  const settingsP = getOrCreateSettings(userId);
  const [t, messages, accounts, archivedAccounts, settings, allRatesMap, summary] =
    await Promise.all([
      getTranslations("accounts"),
      getMessages(),
      fetchUserAccountsWithHoldings(userId),
      fetchUserArchivedAccountsWithHoldings(userId),
      settingsP,
      getAllExchangeRates(),
      settingsP.then((s) => getCachedNetWorthSummary(userId, s.baseCurrency)),
    ]);

  const baseCurrency = settings.baseCurrency;
  const hasAssetAccounts = summary.accounts.some(
    (account) => account.type === "ASSET" && account.totalValueInBaseCurrency > 0,
  );

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
          overview={hasAssetAccounts ? <PortfolioHeatmap summary={summary} fillHeight /> : null}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function AccountsPage() {
  return <AccountsContent />;
}
