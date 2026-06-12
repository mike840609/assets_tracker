import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { updateStockWatchItemSchema } from "@/lib/validators";
import {
  invalidateStockWatchCaches,
  serializeStockWatchItem,
} from "@/lib/services/stock-watch-service";

type IdCtx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateStockWatchItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = {
    name: parsed.data.name,
    exchange: parsed.data.exchange,
    currency: parsed.data.currency,
    recordPrice: parsed.data.recordPrice,
    recordDate: parsed.data.recordDate
      ? new Date(`${parsed.data.recordDate}T00:00:00.000Z`)
      : undefined,
    note: parsed.data.note === undefined ? undefined : parsed.data.note?.trim() || null,
  };

  if (Object.values(data).every((v) => v === undefined)) {
    return failure("No fields to update", 400);
  }

  // Ownership is folded into the write itself (updateMany can filter on
  // userId; update on bare id cannot) — no check-then-write TOCTOU window.
  const { count } = await prisma.stockWatchItem.updateMany({ where: { id, userId }, data });
  if (count === 0) return failure("Not found", 404);

  // updateMany doesn't return the row — re-read it for the response.
  const item = await prisma.stockWatchItem.findFirst({ where: { id, userId } });
  if (!item) return failure("Not found", 404);

  invalidateStockWatchCaches(userId);
  return ok(serializeStockWatchItem(item));
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const { count } = await prisma.stockWatchItem.deleteMany({ where: { id, userId } });
  if (count === 0) return failure("Not found", 404);

  invalidateStockWatchCaches(userId);
  return ok({ ok: true });
});
