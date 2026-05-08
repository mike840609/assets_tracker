import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema, updateCashTransactionSchema } from "@/lib/validators";
import { calculateBalanceDelta } from "@/lib/services/balance";
import { ok, failure, validationError } from "@/lib/api-responses";

async function invalidateAccountCaches(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { userId: true } });
  if (account) {
    revalidateTag(`accounts:${account.userId}`, "max");
    revalidateTag(`net-worth:${account.userId}`, "max");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
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
      return failure("Transaction not found", 404);
    }

    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { id: _txId, ...data } = parsed.data;

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

    await invalidateAccountCaches(accountId);
    return ok(updatedTx);
  }

  const cashTx = await prisma.cashTransaction.findUnique({
    where: { id: transactionId },
    include: { account: true },
  });

  if (cashTx) {
    if (cashTx.accountId !== accountId) {
      return failure("Transaction not found", 404);
    }

    // Since UI might send `quantity` for amount, let's map it if `amount` is missing.
    if (body.quantity !== undefined && body.amount === undefined) {
      body.amount = body.quantity;
    }

    const parsed = updateCashTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { id: _txId, ...data } = parsed.data;

    // Recompute balance delta whenever amount or type changes.
    if (data.amount !== undefined || data.type !== undefined) {
      const oldTx = { type: cashTx.type, amount: Number(cashTx.amount) };
      const newTx = {
        type: data.type ?? cashTx.type,
        amount: data.amount ?? Number(cashTx.amount),
      };
      const delta = calculateBalanceDelta(oldTx, newTx);
      if (delta !== 0) {
        await prisma.account.update({
          where: { id: accountId },
          data: { cashBalance: { increment: delta } },
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

    await invalidateAccountCaches(accountId);
    return ok(updatedTx);
  }

  return failure("Transaction not found", 404);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  const { id: accountId, transactionId } = await params;

  const holdingTx = await prisma.holdingTransaction.findUnique({
    where: { id: transactionId },
    include: { holding: true },
  });

  if (holdingTx) {
    if (holdingTx.holding.accountId !== accountId) {
      return failure("Transaction not found", 404);
    }

    const newHoldingQty = Number(holdingTx.holding.quantity) - Number(holdingTx.quantity);
    await prisma.holding.update({
      where: { id: holdingTx.holding.id },
      data: { quantity: newHoldingQty },
    });

    await prisma.holdingTransaction.delete({ where: { id: transactionId } });
    await invalidateAccountCaches(accountId);
    return ok({ ok: true });
  }

  const cashTx = await prisma.cashTransaction.findUnique({
    where: { id: transactionId },
    include: { account: true },
  });

  if (cashTx) {
    if (cashTx.accountId !== accountId) {
      return failure("Transaction not found", 404);
    }

    const delta = calculateBalanceDelta({ type: cashTx.type, amount: Number(cashTx.amount) }, null);
    await prisma.account.update({
      where: { id: accountId },
      data: { cashBalance: { increment: delta } },
    });

    await prisma.cashTransaction.delete({ where: { id: transactionId } });
    await invalidateAccountCaches(accountId);
    return ok({ ok: true });
  }

  return failure("Transaction not found", 404);
}
