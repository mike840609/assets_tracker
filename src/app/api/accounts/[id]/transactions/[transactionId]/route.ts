import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: accountId, transactionId } = await params;
  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  const existingTx = await prisma.holdingTransaction.findUnique({
    where: { id: transactionId },
    include: { holding: true },
  });

  if (!existingTx || existingTx.holding.accountId !== accountId) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Update HoldingTransaction
  // If quantity was provided, adjust the parent Holding's quantity
  if (data.quantity !== undefined) {
    const diff = data.quantity - Number(existingTx.quantity);
    if (diff !== 0) {
      const newHoldingQty = Number(existingTx.holding.quantity) + diff;
      await prisma.holding.update({
        where: { id: existingTx.holding.id },
        data: { quantity: newHoldingQty },
      });
    }
  }

  const updatedTx = await prisma.holdingTransaction.update({
    where: { id: transactionId },
    data: {
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.note !== undefined && { note: data.note }),
      ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
    },
  });

  return NextResponse.json(updatedTx);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: accountId, transactionId } = await params;

  const existingTx = await prisma.holdingTransaction.findUnique({
    where: { id: transactionId },
    include: { holding: true },
  });

  if (!existingTx || existingTx.holding.accountId !== accountId) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Reverse the transaction's effect on the Holding
  const newHoldingQty = Number(existingTx.holding.quantity) - Number(existingTx.quantity);
  await prisma.holding.update({
    where: { id: existingTx.holding.id },
    data: { quantity: newHoldingQty },
  });

  await prisma.holdingTransaction.delete({
    where: { id: transactionId },
  });

  return NextResponse.json({ ok: true });
}
