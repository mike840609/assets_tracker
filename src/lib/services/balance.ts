import { CashTransactionType } from "@/generated/prisma/client";

type CashTxInput = { type: CashTransactionType; amount: number };

/**
 * Calculates the net change to an account's cash balance for a cash transaction
 * create, edit, or delete operation.
 *
 * Pass `null` for `oldTx` on create, `null` for `newTx` on delete, and both
 * for an edit (PATCH). The result should be applied as `cashBalance += delta`.
 */
export function calculateBalanceDelta(
  oldTx: CashTxInput | null,
  newTx: CashTxInput | null
): number {
  const toSign = (tx: CashTxInput): number => {
    if (tx.type === "DEPOSIT") return tx.amount;
    if (tx.type === "WITHDRAWAL") return -tx.amount;
    return tx.amount; // EDIT: amount is the explicit balance adjustment
  };
  return (newTx ? toSign(newTx) : 0) - (oldTx ? toSign(oldTx) : 0);
}
