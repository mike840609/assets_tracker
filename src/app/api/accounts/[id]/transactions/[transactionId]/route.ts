import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema, updateCashTransactionSchema } from "@/lib/validators";
import {
  calculateBalanceDelta,
  calculateHoldingQuantityDelta,
  getCashTransactionAmountError,
  normalizeHoldingTransactionQuantity,
} from "@/lib/services/balance";
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

    const nextType = data.type ?? holdingTx.type;
    const nextQuantity = normalizeHoldingTransactionQuantity({
      type: nextType,
      quantity: data.quantity ?? Number(holdingTx.quantity),
    });
    const holdingDelta = calculateHoldingQuantityDelta(
      { type: holdingTx.type, quantity: Number(holdingTx.quantity) },
      { type: nextType, quantity: nextQuantity },
    );
    const nextHoldingQty = Number(holdingTx.holding.quantity) + holdingDelta;
    if (nextHoldingQty < 0) {
      return failure("Holding quantity cannot be negative", 400);
    }

    const updatedTx = await prisma.$transaction(async (tx) => {
      if (holdingDelta !== 0) {
        await tx.holding.update({
          where: { id: holdingTx.holding.id },
          data: { quantity: nextHoldingQty },
        });
      }

      return tx.holdingTransaction.update({
        where: { id: transactionId },
        data: {
          ...(data.quantity !== undefined && { quantity: nextQuantity }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.note !== undefined && { note: data.note }),
          ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
        },
      });
    });

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
    const nextCashTx = {
      type: data.type ?? cashTx.type,
      amount: data.amount ?? Number(cashTx.amount),
    };
    const amountError = getCashTransactionAmountError(nextCashTx);
    if (amountError) return failure(amountError, 400);

    // Recompute balance delta whenever amount or type changes.
    if (data.amount !== undefined || data.type !== undefined) {
      const oldTx = { type: cashTx.type, amount: Number(cashTx.amount) };
      const delta = calculateBalanceDelta(oldTx, nextCashTx);
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

    const holdingDelta = calculateHoldingQuantityDelta(
      { type: holdingTx.type, quantity: Number(holdingTx.quantity) },
      null,
    );
    const nextHoldingQty = Number(holdingTx.holding.quantity) + holdingDelta;
    if (nextHoldingQty < 0) {
      return failure("Holding quantity cannot be negative", 400);
    }

    await prisma.$transaction([
      prisma.holding.update({
        where: { id: holdingTx.holding.id },
        data: { quantity: nextHoldingQty },
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
