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
    where: { accountId: id, quantity: { gt: 0 } },
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

  // Check if holding already exists in this account
  const existing = await prisma.holding.findUnique({
    where: { accountId_symbol: { accountId: id, symbol: parsed.data.symbol } },
  });

  let holding;
  if (existing) {
    // Add to existing holding quantity
    const newQuantity = Number(existing.quantity) + parsed.data.quantity;
    holding = await prisma.holding.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    });
  } else {
    holding = await prisma.holding.create({
      data: {
        accountId: id,
        ...parsed.data,
      },
    });
  }

  // Log the transaction
  await prisma.holdingTransaction.create({
    data: {
      holdingId: holding.id,
      type: "BUY",
      quantity: parsed.data.quantity,
    },
  });

  // Auto-fetch the market price for the holding
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

  // Log quantity change as EDIT transaction
  if (data.quantity !== undefined) {
    const existing = await prisma.holding.findUnique({ where: { id } });
    if (existing) {
      const diff = data.quantity - Number(existing.quantity);
      if (diff !== 0) {
        await prisma.holdingTransaction.create({
          data: {
            holdingId: id,
            type: "EDIT",
            quantity: diff,
            note: `Quantity changed from ${Number(existing.quantity)} to ${data.quantity}`,
          },
        });
      }
    }
  }

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
