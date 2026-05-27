import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createHoldingSchema, updateHoldingSchema } from "@/lib/validators";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { parseOccSymbol, formatOptionLabel, OptionError } from "@/lib/options";
import { log } from "@/lib/logger";

type IdCtx = { params: Promise<{ id: string }> };

function invalidateUserCaches(userId: string) {
  revalidateTag(`accounts:${userId}`, { expire: 0 });
  revalidateTag(`net-worth:${userId}`, { expire: 0 });
  revalidateTag(`history:${userId}`, { expire: 0 });
}

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

export const GET = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const account = await prisma.account.findUnique({ where: { id, userId } });
  if (!account) return failure("Not found", 404);

  const holdings = await prisma.holding.findMany({
    where: { accountId: id, quantity: { gt: 0 } },
    orderBy: { symbol: "asc" },
  });
  return ok(holdings);
});

export const POST = withAuth<IdCtx>(async (request, { params }, userId) => {
  const limited = rateLimitCheckWithPrune(request, { limit: 60, prefix: "holdings-create" });
  if (limited) return limited;

  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id, userId },
    select: { id: true },
  });
  if (!account) return failure("Not found", 404);

  const body = await request.json();
  const parsed = createHoldingSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // For OPTION holdings, derive metadata from the OCC symbol on the server
  // — never trust client-supplied option fields.
  let optionMetadata: {
    underlyingSymbol: string;
    optionType: "CALL" | "PUT";
    strike: number;
    expiration: Date;
    contractMultiplier: 100;
    currency: "USD";
    name: string;
  } | null = null;

  if (parsed.data.assetType === "OPTION") {
    try {
      const p = parseOccSymbol(parsed.data.symbol);
      optionMetadata = {
        underlyingSymbol: p.underlying,
        optionType: p.optionType,
        strike: p.strike,
        expiration: p.expiration,
        contractMultiplier: p.contractMultiplier,
        currency: "USD",
        name: parsed.data.name?.trim() || formatOptionLabel(p),
      };
    } catch (err) {
      const message = err instanceof OptionError ? err.message : "Invalid OCC option symbol";
      return failure(message, 400);
    }
  }

  // Check if holding already exists in this account
  const existing = await prisma.holding.findUnique({
    where: { accountId_symbol: { accountId: id, symbol: parsed.data.symbol } },
  });

  let holding;
  if (existing) {
    // Add to existing holding quantity
    const newQuantity = Number(existing.quantity) + parsed.data.quantity;
    holding = await prisma.holding.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    });
  } else if (optionMetadata) {
    holding = await prisma.holding.create({
      data: {
        accountId: id,
        symbol: parsed.data.symbol,
        name: optionMetadata.name,
        quantity: parsed.data.quantity,
        currency: optionMetadata.currency,
        assetType: "OPTION",
        underlyingSymbol: optionMetadata.underlyingSymbol,
        optionType: optionMetadata.optionType,
        strike: optionMetadata.strike,
        expiration: optionMetadata.expiration,
        contractMultiplier: optionMetadata.contractMultiplier,
      },
    });
  } else {
    holding = await prisma.holding.create({
      data: { accountId: id, ...parsed.data },
    });
  }

  // Log the transaction
  await prisma.holdingTransaction.create({
    data: { holdingId: holding.id, type: "BUY", quantity: parsed.data.quantity },
  });

  // Auto-fetch the market price for the holding
  try {
    const isCrypto = parsed.data.assetType === "CRYPTO";
    const priceResults = isCrypto
      ? await fetchCryptoPrices([holding.symbol])
      : await fetchStockPrices([holding.symbol]);

    const result = priceResults.get(holding.symbol);
    if (result) {
      await prisma.priceCache.upsert({
        where: { symbol: holding.symbol },
        update: { price: result.price, currency: result.currency, updatedAt: new Date() },
        create: { symbol: holding.symbol, price: result.price, currency: result.currency },
      });
    }
  } catch (error) {
    // Non-blocking: if price fetch fails, holding is still created
    log.error("holdings.price_fetch.failed", { symbol: holding.symbol, error: String(error) });
  }

  invalidateUserCaches(userId);
  if (holding.currency) void maybeWarmExchangeRate(holding.currency);
  return ok(holding, { status: 201 });
});

export const PATCH = withAuth<IdCtx>(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = updateHoldingSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { id, ...data } = parsed.data;

  const existing = await prisma.holding.findFirst({
    where: { id, account: { userId } },
  });
  if (!existing) return failure("Not found", 404);

  // Log quantity change as EDIT transaction
  if (data.quantity !== undefined) {
    const diff = data.quantity - Number(existing.quantity);
    if (diff !== 0) {
      await prisma.holdingTransaction.create({
        data: {
          holdingId: id,
          type: "EDIT",
          quantity: diff,
          note: `Quantity changed from ${Number(existing.quantity)} to ${data.quantity}`,
        },
      });
    }
  }

  const holding = await prisma.holding.update({ where: { id }, data });
  invalidateUserCaches(userId);
  return ok(holding);
});

export const DELETE = withAuth<IdCtx>(async (request, _ctx, userId) => {
  const body = await request.json();
  const { id } = body;
  if (!id) return failure("Holding ID required");

  const owned = await prisma.holding.findFirst({
    where: { id, account: { userId } },
    select: { id: true },
  });
  if (!owned) return failure("Not found", 404);

  await prisma.holding.delete({ where: { id } });
  invalidateUserCaches(userId);
  return ok({ ok: true });
});
