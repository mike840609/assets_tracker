import type { CashTransactionType, TransactionType } from "@/generated/prisma/client";

type CashTxInput = { type: CashTransactionType; amount: number };
type HoldingTxInput = { type: TransactionType; quantity: number };

export function getCashTransactionAmountError(tx: CashTxInput): string | null {
  if (tx.type === "DEPOSIT" || tx.type === "WITHDRAWAL") {
    return tx.amount > 0 ? null : "Amount must be positive";
  }
  return tx.amount !== 0 ? null : "Adjustment amount cannot be zero";
}

/**
 * Calculates the net change to an account's cash balance for a cash transaction
 * create, edit, or delete operation.
 *
 * Pass `null` for `oldTx` on create, `null` for `newTx` on delete, and both
 * for an edit (PATCH). The result should be applied as `cashBalance += delta`.
 */
export function calculateBalanceDelta(
  oldTx: CashTxInput | null,
  newTx: CashTxInput | null,
): number {
  const toSign = (tx: CashTxInput): number => {
    if (tx.type === "DEPOSIT") return tx.amount;
    if (tx.type === "WITHDRAWAL") return -tx.amount;
    return tx.amount; // EDIT: amount is the explicit balance adjustment
  };
  return (newTx ? toSign(newTx) : 0) - (oldTx ? toSign(oldTx) : 0);
}

export function getHoldingTransactionQuantityError(tx: HoldingTxInput): string | null {
  if (tx.type === "BUY" || tx.type === "SELL") {
    return tx.quantity > 0 ? null : "Quantity must be positive";
  }
  return tx.quantity !== 0 ? null : "Adjustment quantity cannot be zero";
}

function getHoldingQuantityEffect(tx: HoldingTxInput): number {
  if (tx.type === "BUY") return Math.abs(tx.quantity);
  if (tx.type === "SELL") return -Math.abs(tx.quantity);
  return tx.quantity; // EDIT: quantity is the explicit adjustment delta
}

export function normalizeHoldingTransactionQuantity(tx: HoldingTxInput): number {
  return tx.type === "EDIT" ? tx.quantity : Math.abs(tx.quantity);
}

export function calculateHoldingQuantityDelta(
  oldTx: HoldingTxInput | null,
  newTx: HoldingTxInput | null,
): number {
  return (
    (newTx ? getHoldingQuantityEffect(newTx) : 0) - (oldTx ? getHoldingQuantityEffect(oldTx) : 0)
  );
}
