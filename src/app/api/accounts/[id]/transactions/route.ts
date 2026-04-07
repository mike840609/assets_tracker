import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.max(1, Number(searchParams.get("limit") || "20"));

  const take = limit * page;
  const skip = (page - 1) * limit;

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
      take,
    }),
    prisma.cashTransaction.findMany({
      where: {
        accountId: id,
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const merged = [
    ...holdingTx.map(t => ({ ...t, isCash: false })),
    ...cashTx.map(t => ({ ...t, isCash: true, quantity: t.amount })), // Map amount to quantity for unified UI handling
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
   .slice(skip, skip + limit);

  return NextResponse.json(merged);
}
