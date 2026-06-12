import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createHoldingSchema, updateHoldingSchema, deleteHoldingSchema } from "@/lib/validators";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
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
    revalidateTag("exchange-rates", { expire: 0 });
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

  // Atomic upsert: increment on the existing row avoids the read-modify-write
  // race when two adds for the same symbol land concurrently, and the BUY log
  // commits with the holding so the audit trail can't diverge.
  const holding = await prisma.$transaction(async (tx) => {
    const upserted = await tx.holding.upsert({
      where: { accountId_symbol: { accountId: id, symbol: parsed.data.symbol } },
      update: { quantity: { increment: parsed.data.quantity } },
      create: optionMetadata
        ? {
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
          }
        : { accountId: id, ...parsed.data },
    });

    await tx.holdingTransaction.create({
      data: { holdingId: upserted.id, type: "BUY", quantity: parsed.data.quantity },
    });

    return upserted;
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
      revalidateTag("prices", { expire: 0 });
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

  // The schema already bars assetType: "OPTION"; also bar converting an
  // existing OPTION away — that would orphan the OCC fields and misprice the
  // row (no contract multiplier applied). The UI never offers this.
  if (data.assetType !== undefined && existing.assetType === "OPTION") {
    return failure("Cannot change the asset type of an option holding", 400);
  }

  // Quantity 0 is only meaningful for options ("close the position" keeps the
  // transaction history; DELETE would cascade it away). Non-option holdings
  // must go through DELETE instead of leaving zombie zero-quantity rows.
  if (data.quantity === 0 && existing.assetType !== "OPTION") {
    return failure("Quantity must be positive", 400);
  }

  // Update and EDIT audit log commit together — a failed update must not
  // leave a phantom EDIT transaction behind.
  const holding = await prisma.$transaction(async (tx) => {
    const updated = await tx.holding.update({ where: { id }, data });

    if (data.quantity !== undefined) {
      const diff = data.quantity - Number(existing.quantity);
      if (diff !== 0) {
        await tx.holdingTransaction.create({
          data: {
            holdingId: id,
            type: "EDIT",
            quantity: diff,
            note: `Quantity changed from ${Number(existing.quantity)} to ${data.quantity}`,
          },
        });
      }
    }

    return updated;
  });
  invalidateUserCaches(userId);
  return ok(holding);
});

export const DELETE = withAuth<IdCtx>(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = deleteHoldingSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // Ownership is folded into the write itself (deleteMany can filter on the
  // account relation, delete cannot) — no check-then-write TOCTOU window.
  const { count } = await prisma.holding.deleteMany({
    where: { id: parsed.data.id, account: { userId } },
  });
  if (count === 0) return failure("Not found", 404);

  invalidateUserCaches(userId);
  return ok({ ok: true });
});
