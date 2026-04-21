import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { ok } from "@/lib/api-responses";

export async function POST() {
  const settings = await prisma.setting.findFirst();
  const baseCurrency = settings?.baseCurrency ?? "USD";

  const accounts = await prisma.account.findMany({
    select: { currency: true },
    distinct: ["currency"],
  });
  const otherCurrencies = accounts
    .map((a) => a.currency)
    .filter((c) => c !== baseCurrency);

  const results = await Promise.all([
    refreshExchangeRates(baseCurrency),
    ...otherCurrencies.map((currency) => refreshExchangeRates(currency)),
  ]);
  const totalUpdated = results.reduce((a, b) => a + b, 0);

  revalidateTag("exchange-rates");
  return ok({ updated: totalUpdated, baseCurrency });
}
