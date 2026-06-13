import { prisma } from "@/lib/prisma";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { reorderStocksSchema } from "@/lib/validators";
import { invalidateStockWatchCaches } from "@/lib/services/stock-watch-service";

export const PATCH = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = reorderStocksSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return failure("Duplicate stock ids are not allowed", 400);
  }

  // The payload must cover exactly the user's tracked stocks — no missing rows,
  // no foreign ids — so sortOrder stays a dense 0..n-1 sequence.
  const tracked = await prisma.stockWatchItem.findMany({
    where: { userId },
    select: { id: true },
  });
  if (tracked.length !== orderedIds.length) {
    return failure("Reorder payload must include all tracked stocks", 400);
  }
  const ownedIds = new Set(tracked.map((stock) => stock.id));
  if (!orderedIds.every((id) => ownedIds.has(id))) {
    return failure("Reorder payload does not match owned tracked stocks", 400);
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.stockWatchItem.update({
        where: { id, userId },
        data: { sortOrder: index },
      }),
    ),
  );

  invalidateStockWatchCaches(userId);
  return ok({ ok: true });
});
