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

  const existing = await prisma.stockWatchItem.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return failure("Not found", 404);

  const item = await prisma.stockWatchItem.update({
    where: { id },
    data: {
      name: parsed.data.name,
      exchange: parsed.data.exchange,
      currency: parsed.data.currency,
      recordPrice: parsed.data.recordPrice,
      recordDate: parsed.data.recordDate
        ? new Date(`${parsed.data.recordDate}T00:00:00.000Z`)
        : undefined,
      note: parsed.data.note === undefined ? undefined : parsed.data.note?.trim() || null,
    },
  });

  invalidateStockWatchCaches(userId);
  return ok(serializeStockWatchItem(item));
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const existing = await prisma.stockWatchItem.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return failure("Not found", 404);

  await prisma.stockWatchItem.delete({ where: { id } });
  invalidateStockWatchCaches(userId);
  return ok({ ok: true });
});
