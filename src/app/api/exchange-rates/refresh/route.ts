import { prisma } from "@/lib/prisma";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-responses";
import { invalidateExchangeRateData } from "@/lib/cache-invalidation";

export const POST = withAuth(async (_request, _ctx, userId) => {
  const settings = await prisma.setting.findUnique({ where: { userId } });
  const baseCurrency = settings?.baseCurrency ?? "USD";

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { currency: true },
    distinct: ["currency"],
  });
  const otherCurrencies = accounts.map((a) => a.currency).filter((c) => c !== baseCurrency);

  const results = await Promise.all([
    refreshExchangeRates(baseCurrency),
    ...otherCurrencies.map((currency) => refreshExchangeRates(currency)),
  ]);
  const totalUpdated = results.reduce((a, b) => a + b, 0);

  invalidateExchangeRateData();
  return ok({ updated: totalUpdated, baseCurrency });
});
