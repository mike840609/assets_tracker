import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure } from "@/lib/api-responses";

interface UnifiedRow {
  id: string;
  isCash: boolean;
  type: string;
  quantity: unknown; // Decimal from DB
  note: string | null;
  createdAt: Date;
  occurrenceDate: Date | null;
  holdingId: string | null;
}

const cursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
});

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
  ).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString());
    const parsed = cursorSchema.parse(raw);
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
}

export const GET = withAuth(
  async (request, { params }: { params: Promise<{ id: string }> }, userId) => {
    const { id } = await params;

    const account = await prisma.account.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!account) return failure("Not found", 404);

    const { searchParams } = new URL(request.url);

    const rawLimit = Number(searchParams.get("limit") || "20");
    const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 20));
    const cursorParam = searchParams.get("cursor");

    let rows: UnifiedRow[];

    if (cursorParam) {
      // Cursor-based keyset pagination — O(1) regardless of position
      const decoded = decodeCursor(cursorParam);
      if (!decoded) return failure("Invalid cursor", 400);
      const { createdAt: cursorDate, id: cursorId } = decoded;

      rows = await prisma.$queryRaw<UnifiedRow[]>`
      SELECT id, false AS "isCash", type::text, quantity, note, "createdAt", NULL AS "occurrenceDate", "holdingId"
      FROM "HoldingTransaction"
      WHERE "holdingId" IN (SELECT id FROM "Holding" WHERE "accountId" = ${id})
        AND ("createdAt", id) < (${cursorDate}::timestamptz, ${cursorId}::text)

      UNION ALL

      SELECT id, true AS "isCash", type::text, amount AS quantity, note, "createdAt", "occurrenceDate", NULL AS "holdingId"
      FROM "CashTransaction"
      WHERE "accountId" = ${id}
        AND ("createdAt", id) < (${cursorDate}::timestamptz, ${cursorId}::text)

      ORDER BY "createdAt" DESC, id DESC
      LIMIT ${limit + 1}
    `;
    } else {
      // Initial load or legacy page-param fallback
      const rawPage = Number(searchParams.get("page") || "1");
      const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
      const offset = (page - 1) * limit;

      rows = await prisma.$queryRaw<UnifiedRow[]>`
      SELECT id, false AS "isCash", type::text, quantity, note, "createdAt", NULL AS "occurrenceDate", "holdingId"
      FROM "HoldingTransaction"
      WHERE "holdingId" IN (SELECT id FROM "Holding" WHERE "accountId" = ${id})

      UNION ALL

      SELECT id, true AS "isCash", type::text, amount AS quantity, note, "createdAt", "occurrenceDate", NULL AS "holdingId"
      FROM "CashTransaction"
      WHERE "accountId" = ${id}

      ORDER BY "createdAt" DESC, id DESC
      LIMIT ${limit + 1}
      OFFSET ${offset}
    `;
    }

    // N+1 trick: fetching limit+1 tells us if there are more rows without a COUNT()
    const hasMore = rows.length > limit;
    if (hasMore) rows = rows.slice(0, limit);
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1]) : undefined;

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

    const transactions = rows.map((row) => ({
      id: row.id,
      isCash: row.isCash,
      type: row.type,
      quantity: row.quantity,
      note: row.note,
      createdAt: row.createdAt,
      occurrenceDate: row.occurrenceDate,
      ...(row.holdingId
        ? { holdingId: row.holdingId, holding: holdingsMap.get(row.holdingId) ?? null }
        : {}),
    }));

    return ok({ transactions, nextCursor, hasMore });
  },
);
