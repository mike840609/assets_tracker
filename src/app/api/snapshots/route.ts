import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const baseCurrency = searchParams.get("currency") ?? "USD";

  const where: Record<string, unknown> = { baseCurrency };
  if (from) where.date = { ...(where.date as object || {}), gte: new Date(from) };
  if (to) where.date = { ...(where.date as object || {}), lte: new Date(to) };

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where,
    orderBy: { date: "asc" },
  });
  return NextResponse.json(snapshots);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const baseCurrency = body.baseCurrency ?? "USD";
  const snapshot = await createSnapshot(baseCurrency);
  return NextResponse.json(snapshot, { status: 201 });
}
