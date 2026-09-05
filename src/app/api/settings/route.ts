import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/validators";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { failure, ok, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { log } from "@/lib/logger";

async function maybeWarmExchangeRate(currency: string) {
  try {
    const existing = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: currency },
      select: { fromCurrency: true },
    });
    if (existing) return;
    await refreshExchangeRates(currency);
    revalidateTag("exchange-rates", { expire: 0 });
  } catch (error) {
    log.warn("rates.warm.failed", { currency, error: String(error) });
  }
}

export const GET = withAuth(
  async (_req, _ctx, userId) => {
    const settings = await getOrCreateSettings(userId);
    return ok(settings);
  },
  { demo: "allow" },
);

export const PATCH = withAuth(
  async (request, _ctx, userId, principal) => {
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const current = await prisma.setting.findUnique({
      where: { userId },
      select: { baseCurrency: true, secondaryCurrency: true },
    });
    const effectiveBaseCurrency = parsed.data.baseCurrency ?? current?.baseCurrency ?? "USD";
    const effectiveSecondaryCurrency =
      parsed.data.secondaryCurrency !== undefined
        ? parsed.data.secondaryCurrency
        : (current?.secondaryCurrency ?? null);
    if (effectiveSecondaryCurrency === effectiveBaseCurrency) {
      return failure("Secondary currency must differ from base currency", 400);
    }

    const settings = await prisma.setting.upsert({
      where: { userId },
      update: {
        ...(parsed.data.baseCurrency !== undefined && { baseCurrency: parsed.data.baseCurrency }),
        ...(parsed.data.secondaryCurrency !== undefined && {
          secondaryCurrency: parsed.data.secondaryCurrency,
        }),
        ...(parsed.data.locale !== undefined && { locale: parsed.data.locale }),
      },
      create: {
        userId,
        baseCurrency: parsed.data.baseCurrency ?? "USD",
        locale: parsed.data.locale ?? "en-US",
        secondaryCurrency: parsed.data.secondaryCurrency ?? null,
      },
    });

    revalidateTag(`settings:${userId}`, { expire: 0 });
    // If the base currency changed, the cached net-worth summary for this
    // user is stale (values are denominated in the old currency).
    if (parsed.data.baseCurrency !== undefined) {
      const baseCurrency = parsed.data.baseCurrency;
      revalidateTag(`net-worth:${userId}`, { expire: 0 });
      if (principal.kind === "formal") {
        after(() => maybeWarmExchangeRate(baseCurrency));
      }
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
  },
  { demo: "allow" },
);
