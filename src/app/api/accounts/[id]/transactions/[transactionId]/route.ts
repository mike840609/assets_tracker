import { revalidateTag } from "next/cache";
import type { TransactionType } from "@/generated/prisma/client";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema, updateCashTransactionSchema } from "@/lib/validators";
import {
  calculateBalanceDelta,
  calculateHoldingQuantityDelta,
  getCashTransactionAmountError,
  getHoldingTransactionQuantityError,
  normalizeHoldingTransactionQuantity,
  toDbMoneyDelta,
} from "@/lib/services/balance";
import { getFreshExchangeRates, resolveRate } from "@/lib/services/exchange-rate-service";
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
class GeneratedBuyCashError extends Error {}

const GENERATED_BUY_CASH_ERROR =
  "Cannot reverse the cash of a generated buy; adjust the balance manually";

/**
 * A holding transaction is "generated" when the DCA materializer
 * (recurring-investment-service.ts) posted it — the only writer that posts a BUY
 * *and* debits the account's cash for it. Manual holding rows never move cash,
 * so only generated buys owe a reversal when they are deleted or resized.
 *
 * `materializedAt` is the durable half of the provenance: `recurringId` is
 * `onDelete: SetNull` and disappears with its rule, while `materializedAt`
 * survives. Rows posted before that column existed carry only `recurringId`, so
 * either mark suffices.
 */
function isGeneratedBuy(tx: {
  type: TransactionType;
  recurringId: string | null;
  materializedAt: Date | null;
}): boolean {
  return tx.type === "BUY" && (tx.materializedAt != null || tx.recurringId != null);
}

/** The stored fields a generated buy's cash reversal is derived from. */
type GeneratedBuyRow = {
  quantity: Decimal;
  unitPrice: Decimal | null;
  cashDebit: Decimal | null;
  holding: { currency: string };
};

/**
 * LEGACY fallback: cash per share for a generated buy that predates `cashDebit`.
 *
 * `unitPrice` is stored in the holding's currency, so a cross-currency pair is
 * converted at *today's* rate — the rate that applied on the occurrence date is
 * not recoverable, and neither is the rule's `amount` (it may have been edited
 * since). This can therefore return a different amount than was originally
 * spent; rows written by the current materializer carry `cashDebit` and never
 * reach here. The common case (holding currency == account currency) resolves to
 * 1 and is exact.
 *
 * DCA rules only ever target plain symbols, never OPTION holdings, so no
 * `contractMultiplier` enters the arithmetic: cash = quantity x unitPrice.
 *
 * Throws `GeneratedBuyCashError` when the cash cannot be derived (no unitPrice,
 * or an unresolvable rate) so callers fail closed instead of writing a balance
 * that only half matches the ledger.
 */
async function legacyCashPerShare(
  unitPrice: Decimal | null,
  holdingCurrency: string,
  accountCurrency: string,
): Promise<Decimal> {
  if (unitPrice === null) throw new GeneratedBuyCashError();
  const price = new Decimal(unitPrice);
  if (holdingCurrency === accountCurrency) return price;
  const rate = resolveRate(await getFreshExchangeRates(), holdingCurrency, accountCurrency);
  if (rate === undefined) throw new GeneratedBuyCashError();
  return price.times(rate);
}

/**
 * Cash to credit back when a generated buy is deleted, in the account's
 * currency. `cashDebit` is what materialization actually removed from the
 * balance, so replaying it is exact — no FX read, no re-derivation from price.
 */
async function generatedBuyReversal(
  tx: GeneratedBuyRow,
  accountCurrency: string,
): Promise<Decimal> {
  if (tx.cashDebit != null) return toDbMoney(new Decimal(tx.cashDebit));
  const perShare = await legacyCashPerShare(tx.unitPrice, tx.holding.currency, accountCurrency);
  return toDbMoney(perShare.times(new Decimal(tx.quantity)));
}

/**
 * Resizing a generated buy to `nextQuantity`: the cash balance delta (growing
 * it spends more — negative; shrinking it gives the difference back — positive)
 * and the `cashDebit` the row must carry afterwards.
 *
 * With `cashDebit` stored, the original amount is scaled by the quantity ratio
 * rather than re-priced, so the row's own cost stays the only input. The scaled
 * debit is written back in the same transaction: it is what a later delete
 * reverses, so leaving it at the pre-resize amount would strand the difference.
 * Deriving the delta from the two stored amounts (equivalent to
 * `cashDebit x (next - old) / old`) keeps balance and row exact to the same
 * 8-dp rounding.
 *
 * `nextCashDebit` is null on the legacy path — there is nothing stored to keep
 * in step, and that path re-derives the amount from quantity every time.
 */
async function generatedBuyResize(
  tx: GeneratedBuyRow,
  accountCurrency: string,
  nextQuantity: number,
): Promise<{ delta: Decimal; nextCashDebit: Decimal | null }> {
  const oldQuantity = new Decimal(tx.quantity);

  if (tx.cashDebit != null) {
    // A zero-quantity BUY carries no per-share cost to scale by (only an
    // imported row can be one), so fail closed rather than divide by zero.
    if (oldQuantity.isZero()) throw new GeneratedBuyCashError();
    const oldCashDebit = toDbMoney(new Decimal(tx.cashDebit));
    const nextCashDebit = toDbMoney(oldCashDebit.times(nextQuantity).div(oldQuantity));
    return { delta: oldCashDebit.minus(nextCashDebit), nextCashDebit };
  }

  const quantityChange = new Decimal(nextQuantity).minus(oldQuantity);
  const perShare = await legacyCashPerShare(tx.unitPrice, tx.holding.currency, accountCurrency);
  return { delta: toDbMoney(perShare.times(quantityChange).negated()), nextCashDebit: null };
}

/** Snap a Decimal money amount to the column's Decimal(28, 8) scale. */
function toDbMoney(amount: Decimal): Decimal {
  return new Decimal(amount.toFixed(8));
}

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
  // when closing an exact-quantity position. Never hand a raw `number` to
  // Prisma for monetary/quantity values.
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

export const PATCH = withAuth<TxCtx>(
  async (request, { params }, userId) => {
    const { id: accountId, transactionId } = await params;

    // `currency` is only needed by the legacy reversal path, which converts a
    // pre-`cashDebit` generated buy's unitPrice into the currency the cash
    // balance is denominated in.
    const account = await prisma.account.findUnique({
      where: { id: accountId, userId },
      select: { id: true, currency: true },
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

      const generated = isGeneratedBuy(holdingTx);
      // A generated buy's cash debit is tied to it being a BUY; turning it into
      // a SELL or EDIT has no meaningful cash reversal, so refuse it outright.
      if (generated && data.type !== undefined && data.type !== holdingTx.type) {
        return failure("Generated buys cannot change type; delete the row instead", 400);
      }

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

      // Resizing a generated buy resizes the cash it consumed: growing it debits
      // more, shrinking it credits the difference back. Resolved before the
      // write so an underivable amount leaves the ledger untouched.
      let cashDelta: Decimal | null = null;
      let nextCashDebit: Decimal | null = null;
      if (generated && data.quantity !== undefined) {
        try {
          ({ delta: cashDelta, nextCashDebit } = await generatedBuyResize(
            holdingTx,
            account.currency,
            nextQuantity,
          ));
        } catch (error) {
          if (error instanceof GeneratedBuyCashError) {
            return failure(GENERATED_BUY_CASH_ERROR, 409);
          }
          throw error;
        }
      }

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
              // Keep the recorded debit in step with the cash this resize
              // moves, so a later delete reverses the resized amount.
              ...(nextCashDebit !== null && { cashDebit: nextCashDebit }),
            },
          });
          if (result.count !== 1) {
            throw new StaleHoldingTransactionError();
          }

          await applyHoldingQuantityDelta(tx, holdingTx.holding.id, holdingDelta);

          if (cashDelta !== null && !cashDelta.isZero()) {
            await tx.account.update({
              where: { id: accountId },
              data: { cashBalance: { increment: cashDelta } },
            });
          }

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
                occurrenceDate:
                  data.occurrenceDate === null ? null : toUtcDate(data.occurrenceDate),
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
                data: { cashBalance: { increment: toDbMoneyDelta(delta) } },
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
  },
  { demo: "allow" },
);

export const DELETE = withAuth<TxCtx>(
  async (_request, { params }, userId) => {
    const { id: accountId, transactionId } = await params;

    // `currency` is only needed by the legacy reversal path, which converts a
    // pre-`cashDebit` generated buy's unitPrice into the currency the cash
    // balance is denominated in.
    const account = await prisma.account.findUnique({
      where: { id: accountId, userId },
      select: { id: true, currency: true },
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

      // Deleting a generated buy must give back the cash its materialization
      // debited, otherwise the balance stays short and the ledger no longer
      // explains it. Resolved before the write so an underivable amount leaves
      // both the shares and the balance untouched. `materializedAt` keeps this
      // working after the source rule has been deleted.
      let cashReversal: Decimal | null = null;
      if (isGeneratedBuy(holdingTx)) {
        try {
          cashReversal = await generatedBuyReversal(holdingTx, account.currency);
        } catch (error) {
          if (error instanceof GeneratedBuyCashError) {
            return failure(GENERATED_BUY_CASH_ERROR, 409);
          }
          throw error;
        }
      }

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

          if (cashReversal !== null && !cashReversal.isZero()) {
            await tx.account.update({
              where: { id: accountId },
              data: { cashBalance: { increment: cashReversal } },
            });
          }
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
              data: { cashBalance: { increment: toDbMoneyDelta(delta) } },
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
  },
  { demo: "allow" },
);
