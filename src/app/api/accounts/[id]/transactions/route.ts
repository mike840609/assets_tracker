import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const transactions = await prisma.holdingTransaction.findMany({
    where: {
      holding: { accountId: id },
    },
    include: {
      holding: {
        select: { symbol: true, name: true, currency: true, assetType: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transactions);
}
