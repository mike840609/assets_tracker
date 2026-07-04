import { revalidateTag } from "next/cache";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema, updateCashTransactionSchema } from "@/lib/validators";
import {
  calculateBalanceDelta,
  calculateHoldingQuantityDelta,
  getCashTransactionAmountError,
  getHoldingTransactionQuantityError,
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

class NegativeHoldingQuantityError extends Error {}
class StaleHoldingTransactionError extends Error {}
class StaleCashTransactionError extends Error {}

// Same convention as the recurring-cash routes: occurrence dates are calendar
// days (YYYY-MM-DD) persisted as UTC midnight into the `@db.Date` column.
function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

async function applyHoldingQuantityDelta(
  tx: Pick<typeof prisma, "holding">,
  holdingId: string,
  delta: number,
) {
  // Snap the float delta to the column's Decimal(18, 8) scale before handing it
  // to Prisma. A raw `number` delta produced by float arithmetic (e.g. 0.1 + 0.2
  // = 0.30000000000000004) would otherwise drift the stored quantity away from
  // its transaction ledger and, worse, spuriously trip the `gte` guard below
  // when closing an exact-quantity position. CLAUDE.md: never hand a raw
  // `number` to Prisma for monetary/quantity values.
  const change = new Decimal(delta.toFixed(8));

  if (change.gt(0)) {
    await tx.holding.update({
      where: { id: holdingId },
      data: { quantity: { increment: change } },
    });
    return;
  }

  if (change.lt(0)) {
    const decrement = change.abs();
    const result = await tx.holding.updateMany({
      where: { id: holdingId, quantity: { gte: decrement } },
      data: { quantity: { decrement } },
    });
    if (result.count !== 1) {
      throw new NegativeHoldingQuantityError();
    }
  }
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
    // Re-check on the merged (existing + patch) values — the schema can only
    // validate per-type rules when both fields are present in the payload.
    const quantityError = getHoldingTransactionQuantityError({
      type: nextType,
      quantity: nextQuantity,
    });
    if (quantityError) return failure(quantityError, 400);
    const holdingDelta = calculateHoldingQuantityDelta(
      { type: holdingTx.type, quantity: Number(holdingTx.quantity) },
      { type: nextType, quantity: nextQuantity },
    );

    let updatedTx;
    try {
      updatedTx = await prisma.$transaction(async (tx) => {
        const result = await tx.holdingTransaction.updateMany({
          where: {
            id: transactionId,
            type: holdingTx.type,
            quantity: holdingTx.quantity,
          },
          data: {
            ...(data.quantity !== undefined && { quantity: nextQuantity }),
            ...(data.type !== undefined && { type: data.type }),
            ...(data.note !== undefined && { note: data.note }),
            ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
          },
        });
        if (result.count !== 1) {
          throw new StaleHoldingTransactionError();
        }

        await applyHoldingQuantityDelta(tx, holdingTx.holding.id, holdingDelta);

        return tx.holdingTransaction.findUniqueOrThrow({
          where: { id: transactionId },
        });
      });
    } catch (error) {
      if (error instanceof NegativeHoldingQuantityError) {
        return failure("Holding quantity cannot be negative", 400);
      }
      if (error instanceof StaleHoldingTransactionError) {
        return failure("Transaction changed while updating; please retry", 409);
      }
      throw error;
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
    const nextCashTx = {
      type: data.type ?? cashTx.type,
      amount: data.amount ?? Number(cashTx.amount),
    };
    const amountError = getCashTransactionAmountError(nextCashTx);
    if (amountError) return failure(amountError, 400);

    // Balance adjustment and transaction update commit atomically so a
    // failure can't leave the cash balance out of sync with the ledger. The
    // row write is guarded on the values the delta was measured against (the
    // same optimistic-lock contract as the holding path), so two concurrent
    // edits can't each apply their own balance delta on top of a row only one
    // of them actually wrote.
    let updatedTx;
    try {
      updatedTx = await prisma.$transaction(async (tx) => {
        const result = await tx.cashTransaction.updateMany({
          where: {
            id: transactionId,
            type: cashTx.type,
            amount: cashTx.amount,
          },
          data: {
            ...(data.amount !== undefined && { amount: data.amount }),
            ...(data.type !== undefined && { type: data.type }),
            ...(data.note !== undefined && { note: data.note }),
            ...(data.createdAt !== undefined && { createdAt: new Date(data.createdAt) }),
            // `null` clears the backdate so analysis falls back to createdAt.
            ...(data.occurrenceDate !== undefined && {
              occurrenceDate: data.occurrenceDate === null ? null : toUtcDate(data.occurrenceDate),
            }),
          },
        });
        if (result.count !== 1) {
          throw new StaleCashTransactionError();
        }

        // Recompute balance delta whenever amount or type changes.
        if (data.amount !== undefined || data.type !== undefined) {
          const oldTx = { type: cashTx.type, amount: Number(cashTx.amount) };
          const delta = calculateBalanceDelta(oldTx, nextCashTx);
          if (delta !== 0) {
            await tx.account.update({
              where: { id: accountId },
              data: { cashBalance: { increment: delta } },
            });
          }
        }

        return tx.cashTransaction.findUniqueOrThrow({
          where: { id: transactionId },
        });
      });
    } catch (error) {
      if (error instanceof StaleCashTransactionError) {
        return failure("Transaction changed while updating; please retry", 409);
      }
      throw error;
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

    const holdingDelta = calculateHoldingQuantityDelta(
      { type: holdingTx.type, quantity: Number(holdingTx.quantity) },
      null,
    );

    try {
      await prisma.$transaction(async (tx) => {
        const result = await tx.holdingTransaction.deleteMany({
          where: {
            id: transactionId,
            type: holdingTx.type,
            quantity: holdingTx.quantity,
          },
        });
        if (result.count !== 1) {
          throw new StaleHoldingTransactionError();
        }

        await applyHoldingQuantityDelta(tx, holdingTx.holding.id, holdingDelta);
      });
    } catch (error) {
      if (error instanceof NegativeHoldingQuantityError) {
        return failure("Holding quantity cannot be negative", 400);
      }
      if (error instanceof StaleHoldingTransactionError) {
        return failure("Transaction changed while deleting; please retry", 409);
      }
      throw error;
    }

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

    // Guard the delete on the values the balance delta was measured against
    // (same optimistic-lock contract as the cash PATCH / holding paths) so a
    // DELETE racing an edit can't apply a stale balance delta against a row
    // another request already changed.
    try {
      await prisma.$transaction(async (tx) => {
        const result = await tx.cashTransaction.deleteMany({
          where: { id: transactionId, type: cashTx.type, amount: cashTx.amount },
        });
        if (result.count !== 1) {
          throw new StaleCashTransactionError();
        }
        const delta = calculateBalanceDelta(
          { type: cashTx.type, amount: Number(cashTx.amount) },
          null,
        );
        if (delta !== 0) {
          await tx.account.update({
            where: { id: accountId },
            data: { cashBalance: { increment: delta } },
          });
        }
      });
    } catch (error) {
      if (error instanceof StaleCashTransactionError) {
        return failure("Transaction changed while deleting; please retry", 409);
      }
      throw error;
    }

    invalidateAccountCaches(userId);
    return ok({ ok: true });
  }

  return failure("Transaction not found", 404);
});
