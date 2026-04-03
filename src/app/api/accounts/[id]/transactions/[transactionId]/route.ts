import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema, updateCashTransactionSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: accountId, transactionId } = await params;
  const body = await request.json();

  // Determine if it's a HoldingTransaction or CashTransaction
  const holdingTx = await prisma.holdingTransaction.findUnique({
    where: { id: transactionId },
    include: { holding: true },
  });

  if (holdingTx) {
    if (holdingTx.holding.accountId !== accountId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    if (data.quantity !== undefined) {
      const diff = data.quantity - Number(holdingTx.quantity);
      if (diff !== 0) {
        const newHoldingQty = Number(holdingTx.holding.quantity) + diff;
        await prisma.holding.update({
          where: { id: holdingTx.holding.id },
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

  const cashTx = await prisma.cashTransaction.findUnique({
    where: { id: transactionId },
    include: { account: true },
  });

  if (cashTx) {
    if (cashTx.accountId !== accountId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Since UI might send `quantity` for amount, let's map it if `amount` is missing.
    if (body.quantity !== undefined && body.amount === undefined) {
      body.amount = body.quantity;
    }

    const parsed = updateCashTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    // We don't automatically adjust account balance for CashTransaction edits, 
    // unless the amount is edited explicitly and we know how to adjust it.
    // Let's do a simple adjustment if amount changed.
    if (data.amount !== undefined) {
       // Only adjust if it's a deposit or withdrawal, EDIT is absolute usually, but here diff is diff
       let diff = data.amount - Number(cashTx.amount);
       // if we are changing type too, it gets complicated. Assuming type doesn't change for now or handled fully manually.
       // Easiest is to adjust balance.
       // Actually user typically adjusts manual cash balance for EDIT.
       // But if DEPOSIT/WITHDRAWAL changed amount:
       const currentType = data.type || cashTx.type;
       if (currentType === "WITHDRAWAL") diff = -diff;
       // if EDIT, diff = diff.
       
       if (diff !== 0) {
         await prisma.account.update({
           where: { id: accountId },
           data: { cashBalance: { increment: diff } }
         });
       }
    }

    const updatedTx = await prisma.cashTransaction.update({
      where: { id: transactionId },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
      },
    });

    return NextResponse.json(updatedTx);
  }

  return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: accountId, transactionId } = await params;

  const holdingTx = await prisma.holdingTransaction.findUnique({
    where: { id: transactionId },
    include: { holding: true },
  });

  if (holdingTx) {
    if (holdingTx.holding.accountId !== accountId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const newHoldingQty = Number(holdingTx.holding.quantity) - Number(holdingTx.quantity);
    await prisma.holding.update({
      where: { id: holdingTx.holding.id },
      data: { quantity: newHoldingQty },
    });

    await prisma.holdingTransaction.delete({
      where: { id: transactionId },
    });

    return NextResponse.json({ ok: true });
  }

  const cashTx = await prisma.cashTransaction.findUnique({
    where: { id: transactionId },
    include: { account: true },
  });

  if (cashTx) {
    if (cashTx.accountId !== accountId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    let diff = -Number(cashTx.amount);
    if (cashTx.type === "WITHDRAWAL") diff = Number(cashTx.amount);

    await prisma.account.update({
      where: { id: accountId },
      data: { cashBalance: { increment: diff } }
    });

    await prisma.cashTransaction.delete({
       where: { id: transactionId }
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
}
