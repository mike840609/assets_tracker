import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";

export async function POST() {
  const settings = await prisma.setting.findFirst();
  const baseCurrency = settings?.baseCurrency ?? "USD";

  // Refresh rates from base currency
  let updated = await refreshExchangeRates(baseCurrency);

  // Also refresh rates for all account currencies that differ from base
  const accounts = await prisma.account.findMany({
    select: { currency: true },
    distinct: ["currency"],
  });
  const otherCurrencies = accounts
    .map((a) => a.currency)
    .filter((c) => c !== baseCurrency);

  for (const currency of otherCurrencies) {
    updated += await refreshExchangeRates(currency);
  }

  return NextResponse.json({ updated, baseCurrency });
}
