import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/validators";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { ok, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { log } from "@/lib/logger";

async function maybeWarmExchangeRate(currency: string) {
  try {
    const existing = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: currency },
      select: { id: true },
    });
    if (existing) return;
    await refreshExchangeRates(currency);
    revalidateTag("exchange-rates", "max");
  } catch (error) {
    log.warn("rates.warm.failed", { currency, error: String(error) });
  }
}

export const GET = withAuth(async (_req, _ctx, userId) => {
  const settings = await getOrCreateSettings(userId);
  return ok(settings);
});

export const PATCH = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const settings = await prisma.setting.upsert({
    where: { userId },
    update: {
      ...(parsed.data.baseCurrency !== undefined && { baseCurrency: parsed.data.baseCurrency }),
      ...(parsed.data.locale !== undefined && { locale: parsed.data.locale }),
    },
    create: {
      userId,
      baseCurrency: parsed.data.baseCurrency ?? "USD",
      locale: parsed.data.locale ?? "en-US",
    },
  });

  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag(`settings:${userId}`, "max");
  // If the base currency changed, the cached net-worth summary for this
  // user is stale (values are denominated in the old currency).
  if (parsed.data.baseCurrency !== undefined) {
    revalidateTag(`net-worth:${userId}`, "max");
    void maybeWarmExchangeRate(parsed.data.baseCurrency);
  }

  const response = ok(settings);

  // Set locale cookie so next-intl picks it up on the next request
  if (parsed.data.locale) {
    response.cookies.set("NEXT_LOCALE", parsed.data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
});
