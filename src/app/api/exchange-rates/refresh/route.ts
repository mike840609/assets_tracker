import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";

export async function POST() {
  const settings = await prisma.setting.findFirst();
  const baseCurrency = settings?.baseCurrency ?? "USD";

  // Refresh rates for base currency and all account currencies in parallel
  const accounts = await prisma.account.findMany({
    select: { currency: true },
    distinct: ["currency"],
  });
  const otherCurrencies = accounts
    .map((a) => a.currency)
    .filter((c) => c !== baseCurrency);

  // Refresh rates for all account currencies in parallel
  const results = await Promise.all([
    refreshExchangeRates(baseCurrency),
    ...otherCurrencies.map((currency) => refreshExchangeRates(currency)),
  ]);
  const totalUpdated = results.reduce((a, b) => a + b, 0);
  
  revalidateTag("exchange-rates", "max");
  return NextResponse.json({ updated: totalUpdated, baseCurrency });
}
