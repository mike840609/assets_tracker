import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHoldingSchema, updateHoldingSchema } from "@/lib/validators";
import { fetchStockPrices, fetchCryptoPrices } from "@/lib/services/price-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const holdings = await prisma.holding.findMany({
    where: { accountId: id },
    orderBy: { symbol: "asc" },
  });
  return NextResponse.json(holdings);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = createHoldingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const holding = await prisma.holding.create({
    data: {
      accountId: id,
      ...parsed.data,
    },
  });

  // Auto-fetch the market price for the newly added holding
  try {
    const isCrypto = parsed.data.assetType === "CRYPTO";
    const priceResults = isCrypto
      ? await fetchCryptoPrices([holding.symbol])
      : await fetchStockPrices([holding.symbol]);

    const result = priceResults.get(holding.symbol);
    if (result) {
      await prisma.priceCache.upsert({
        where: { symbol: holding.symbol },
        update: { price: result.price, currency: result.currency, updatedAt: new Date() },
        create: { symbol: holding.symbol, price: result.price, currency: result.currency },
      });
    }
  } catch (error) {
    // Non-blocking: if price fetch fails, holding is still created
    console.error(`Failed to fetch price for ${holding.symbol}:`, error);
  }

  return NextResponse.json(holding, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _accountId } = await params;
  const body = await request.json();
  const parsed = updateHoldingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const holding = await prisma.holding.update({
    where: { id },
    data,
  });
  return NextResponse.json(holding);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _accountId } = await params;
  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Holding ID required" }, { status: 400 });
  }

  await prisma.holding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
