import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema, updateCashTransactionSchema } from "@/lib/validators";
import { calculateBalanceDelta } from "@/lib/services/balance";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

type TxCtx = { params: Promise<{ id: string; transactionId: string }> };

function invalidateAccountCaches(userId: string) {
  revalidateTag(`accounts:${userId}`, { expire: 0 });
  revalidateTag(`net-worth:${userId}`, { expire: 0 });
  revalidateTag(`history:${userId}`, { expire: 0 });
}

export const PATCH = withAuth<TxCtx>(async (request, { params }, userId) => {
  const { id: accountId, transactionId } = await params;

  const account = await prisma.account.findUnique({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) return failure("Not found", 404);

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

    const txUpdate = prisma.holdingTransaction.update({
      where: { id: transactionId },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
      },
    });

    const diff = data.quantity !== undefined ? data.quantity - Number(holdingTx.quantity) : 0;

    let updatedTx;
    if (diff !== 0) {
      const [, tx] = await prisma.$transaction([
        prisma.holding.update({
          where: { id: holdingTx.holding.id },
          data: { quantity: { increment: diff } },
        }),
        txUpdate,
      ]);
      updatedTx = tx;
    } else {
      updatedTx = await txUpdate;
    }

    invalidateAccountCaches(userId);
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

    const cashTxUpdate = prisma.cashTransaction.update({
      where: { id: transactionId },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
      },
    });

    // Recompute balance delta whenever amount or type changes.
    let delta = 0;
    if (data.amount !== undefined || data.type !== undefined) {
      const oldTx = { type: cashTx.type, amount: Number(cashTx.amount) };
      const newTx = {
        type: data.type ?? cashTx.type,
        amount: data.amount ?? Number(cashTx.amount),
      };
      delta = calculateBalanceDelta(oldTx, newTx);
    }

    let updatedTx;
    if (delta !== 0) {
      const [, tx] = await prisma.$transaction([
        prisma.account.update({
          where: { id: accountId },
          data: { cashBalance: { increment: delta } },
        }),
        cashTxUpdate,
      ]);
      updatedTx = tx;
    } else {
      updatedTx = await cashTxUpdate;
    }

    invalidateAccountCaches(userId);
    return ok(updatedTx);
  }

  return failure("Transaction not found", 404);
});

export const DELETE = withAuth<TxCtx>(async (_request, { params }, userId) => {
  const { id: accountId, transactionId } = await params;

  const account = await prisma.account.findUnique({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) return failure("Not found", 404);

  const holdingTx = await prisma.holdingTransaction.findUnique({
    where: { id: transactionId },
    include: { holding: true },
  });

  if (holdingTx) {
    if (holdingTx.holding.accountId !== accountId) {
      return failure("Transaction not found", 404);
    }

    await prisma.$transaction([
      prisma.holding.update({
        where: { id: holdingTx.holding.id },
        data: { quantity: { decrement: Number(holdingTx.quantity) } },
      }),
      prisma.holdingTransaction.delete({ where: { id: transactionId } }),
    ]);
    invalidateAccountCaches(userId);
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
    invalidateAccountCaches(userId);
    return ok({ ok: true });
  }

  return failure("Transaction not found", 404);
});
