import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [holdingTx, cashTx] = await Promise.all([
    prisma.holdingTransaction.findMany({
      where: {
        holding: { accountId: id },
      },
      include: {
        holding: {
          select: { symbol: true, name: true, currency: true, assetType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cashTransaction.findMany({
      where: {
        accountId: id,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const merged = [
    ...holdingTx.map(t => ({ ...t, isCash: false })),
    ...cashTx.map(t => ({ ...t, isCash: true, quantity: t.amount })), // Map amount to quantity for unified UI handling
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json(merged);
}
