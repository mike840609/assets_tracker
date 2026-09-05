-- Keep DCA-generated buy provenance after its source rule is deleted, and
-- record the exact cash each materialized buy removed from the account.
--
-- HoldingTransaction.recurringId is ON DELETE SET NULL, so deleting a recurring
-- investment made its generated buys indistinguishable from manual ones and
-- their cash debit was never reversed. "materializedAt" survives that deletion.
-- "cashDebit" is stored in the ACCOUNT's currency (the one the cash balance is
-- denominated in), so a reversal replays the original amount instead of
-- recomputing quantity x unitPrice at today's exchange rate.
ALTER TABLE "HoldingTransaction"
  ADD COLUMN "materializedAt" TIMESTAMPTZ(3),
  ADD COLUMN "cashDebit" DECIMAL(28,8);

-- Same compatibility move the CashTransaction provenance migration made: rows
-- still linked to a rule are known-generated, and the legacy materializer wrote
-- createdAt = the occurrence day, the best recoverable bound. Rows whose rule
-- was already deleted have recurringId = NULL and are indistinguishable from
-- manual rows, so they stay unclassified rather than guessed at.
--
-- "cashDebit" is deliberately left NULL for every legacy row: the amount spent
-- per occurrence is not recoverable, because the rule's "amount" may have been
-- edited since the row was posted. Those rows keep the approximate
-- quantity x unitPrice reversal.
UPDATE "HoldingTransaction"
SET "materializedAt" = "createdAt"
WHERE "recurringId" IS NOT NULL;
