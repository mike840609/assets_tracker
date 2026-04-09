import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

type RawRow = {
  id: string;
  type: string;
  quantity: string | null;
  note: string | null;
  createdAt: Date;
  isCash: boolean;
  holdingSymbol: string | null;
  holdingName: string | null;
  holdingCurrency: string | null;
  holdingAssetType: string | null;
  amount: string | null;
  holdingId: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.max(1, Number(searchParams.get("limit") || "20"));
  const offset = (page - 1) * limit;

  // UNION ALL lets the database paginate across both transaction tables in one
  // query, fetching exactly `limit` rows regardless of page number.
  // Previously, the code fetched `limit * page` rows from each table and
  // sliced in JS — O(N) data transferred per page load.
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT
      ht.id,
      ht.type,
      ht.quantity::text       AS quantity,
      ht.note,
      ht."createdAt",
      false                   AS "isCash",
      h.symbol                AS "holdingSymbol",
      h.name                  AS "holdingName",
      h.currency              AS "holdingCurrency",
      h."assetType"           AS "holdingAssetType",
      NULL::text              AS amount,
      ht."holdingId"
    FROM "HoldingTransaction" ht
    JOIN "Holding" h ON h.id = ht."holdingId"
    WHERE h."accountId" = ${id}

    UNION ALL

    SELECT
      ct.id,
      ct.type,
      NULL::text              AS quantity,
      ct.note,
      ct."createdAt",
      true                    AS "isCash",
      NULL                    AS "holdingSymbol",
      NULL                    AS "holdingName",
      NULL                    AS "holdingCurrency",
      NULL                    AS "holdingAssetType",
      ct.amount::text         AS amount,
      NULL::text              AS "holdingId"
    FROM "CashTransaction" ct
    WHERE ct."accountId" = ${id}

    ORDER BY "createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const merged = rows.map((row) =>
    row.isCash
      ? {
          id: row.id,
          accountId: id,
          type: row.type,
          amount: Number(row.amount),
          quantity: Number(row.amount), // unified field for UI
          note: row.note,
          createdAt: row.createdAt,
          isCash: true,
        }
      : {
          id: row.id,
          holdingId: row.holdingId,
          type: row.type,
          quantity: Number(row.quantity),
          note: row.note,
          createdAt: row.createdAt,
          isCash: false,
          holding: {
            symbol: row.holdingSymbol,
            name: row.holdingName,
            currency: row.holdingCurrency,
            assetType: row.holdingAssetType,
          },
        }
  );

  return NextResponse.json(merged);
}
