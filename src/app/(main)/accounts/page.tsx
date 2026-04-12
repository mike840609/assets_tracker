import { getSession } from "@/lib/auth-session";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { prisma } from "@/lib/prisma";
import { AccountsList } from "@/components/accounts/accounts-list";
import { serializeAccountWithHoldings } from "@/lib/types";
import { getAllExchangeRates, resolveRate, resolveMissingRates } from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";

const CLIENT_NAMESPACES = [
  "accountsList",
  "accountForm",
  "quickAddHolding",
  "categories",
];

export const experimental_ppr = true;

export default async function AccountsPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // Run all independent queries in parallel (translations + data)
  const [t, messages, accountsRaw, settings, allRatesMap] = await Promise.all([
    getTranslations("accounts"),
    getMessages(),
    prisma.account.findMany({
      where: { userId },
      include: { holdings: { where: { quantity: { gt: 0 } } } },
      orderBy: { createdAt: "desc" },
    }),
    getOrCreateSettings(userId),
    getAllExchangeRates(),
  ]);

  const baseCurrency = settings.baseCurrency;

  // Fetch cached prices for this user's holding symbols only
  const allSymbols = [...new Set(accountsRaw.flatMap((a) => a.holdings.map((h) => h.symbol)))];
  const cachedPrices = allSymbols.length > 0
    ? await prisma.priceCache.findMany({ where: { symbol: { in: allSymbols } } })
    : [];
  const priceMap: Record<string, number> = Object.fromEntries(
    cachedPrices.map((p) => [p.symbol, Number(p.price)])
  );

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
