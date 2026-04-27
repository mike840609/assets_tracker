import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createHoldingSchema, updateHoldingSchema } from "@/lib/validators";
import { getOrFetchPrices } from "@/lib/services/price-service";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

type IdCtx = { params: Promise<{ id: string }> };

function invalidateUserCaches(userId: string) {
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag(`accounts:${userId}`, "max");
  revalidateTag(`net-worth:${userId}`, "max");
  revalidateTag(`history:${userId}`, "max");
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
  const limited = rateLimitCheckWithPrune(request, { limit: 30, prefix: "holdings-post" });
  if (limited) return limited;

  const { id } = await params;
  const body = await request.json();
  const parsed = createHoldingSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

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
  } else {
    holding = await prisma.holding.create({
      data: { accountId: id, ...parsed.data },
    });
  }

  // Log the transaction
  await prisma.holdingTransaction.create({
    data: { holdingId: holding.id, type: "BUY", quantity: parsed.data.quantity },
  });

  // Auto-fetch the market price for the holding (cache-first; upserts internally).
  // Non-blocking: failures are logged inside getOrFetchPrices and the holding still succeeds.
  await getOrFetchPrices(
    [holding.symbol],
    parsed.data.assetType === "CRYPTO" ? "crypto" : "stock"
  );

  invalidateUserCaches(userId);
  return ok(holding, { status: 201 });
});

export const PATCH = withAuth<IdCtx>(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = updateHoldingSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { id, ...data } = parsed.data;

  // Log quantity change as EDIT transaction
  if (data.quantity !== undefined) {
    const existing = await prisma.holding.findUnique({ where: { id } });
    if (existing) {
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
  }

  const holding = await prisma.holding.update({ where: { id }, data });
  invalidateUserCaches(userId);
  return ok(holding);
});

export const DELETE = withAuth<IdCtx>(async (request, _ctx, userId) => {
  const body = await request.json();
  const { id } = body;
  if (!id) return failure("Holding ID required");

  await prisma.holding.delete({ where: { id } });
  invalidateUserCaches(userId);
  return ok({ ok: true });
});
