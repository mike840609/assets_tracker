import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

type IdCtx = { params: Promise<{ id: string }> };

interface UnifiedRow {
  id: string;
  isCash: boolean;
  type: string;
  quantity: unknown; // Decimal from DB
  note: string | null;
  createdAt: Date;
  holdingId: string | null;
}

export const GET = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;

  // Verify the account belongs to the authenticated user (R5 ownership check)
  const account = await prisma.account.findUnique({ where: { id, userId } });
  if (!account) return failure("Not found", 404);

  // Q11 — Zod-validated pagination params (prevents NaN OFFSET in raw SQL)
  const { searchParams } = new URL(request.url);
  const parsed = paginationQuery.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  // Single UNION ALL query with DB-level ORDER BY + LIMIT/OFFSET
  const rows = await prisma.$queryRaw<UnifiedRow[]>`
    SELECT id, false AS "isCash", type::text, quantity, note, "createdAt", "holdingId"
    FROM "HoldingTransaction"
    WHERE "holdingId" IN (SELECT id FROM "Holding" WHERE "accountId" = ${id})

    UNION ALL

    SELECT id, true AS "isCash", type::text, amount AS quantity, note, "createdAt", NULL AS "holdingId"
    FROM "CashTransaction"
    WHERE "accountId" = ${id}

    ORDER BY "createdAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Hydrate holding details only for the holding transactions on this page
  const holdingIds = [
    ...new Set(rows.filter((r) => r.holdingId).map((r) => r.holdingId as string)),
  ];

  const holdingsMap = new Map<
    string,
    { symbol: string; name: string | null; currency: string; assetType: string }
  >();
  if (holdingIds.length > 0) {
    const holdings = await prisma.holding.findMany({
      where: { id: { in: holdingIds } },
      select: { id: true, symbol: true, name: true, currency: true, assetType: true },
    });
    for (const h of holdings) {
      holdingsMap.set(h.id, {
        symbol: h.symbol,
        name: h.name,
        currency: h.currency,
        assetType: h.assetType,
      });
    }
  }

  const result = rows.map((row) => ({
    id: row.id,
    isCash: row.isCash,
    type: row.type,
    quantity: row.quantity,
    note: row.note,
    createdAt: row.createdAt,
    ...(row.holdingId
      ? { holdingId: row.holdingId, holding: holdingsMap.get(row.holdingId) ?? null }
      : {}),
  }));

  return ok(result);
});
