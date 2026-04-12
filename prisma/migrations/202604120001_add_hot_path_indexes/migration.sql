-- Improve hot-path query performance by optimizing composite sort indexes
-- and adding a staleness index for price cache refresh checks.

DROP INDEX IF EXISTS "HoldingTransaction_holdingId_createdAt_idx";
CREATE INDEX "HoldingTransaction_holdingId_createdAt_desc_idx"
  ON "HoldingTransaction" ("holdingId", "createdAt" DESC);

DROP INDEX IF EXISTS "CashTransaction_accountId_createdAt_idx";
CREATE INDEX "CashTransaction_accountId_createdAt_desc_idx"
  ON "CashTransaction" ("accountId", "createdAt" DESC);

DROP INDEX IF EXISTS "NetWorthSnapshot_userId_date_idx";
CREATE INDEX "NetWorthSnapshot_userId_date_desc_idx"
  ON "NetWorthSnapshot" ("userId", "date" DESC);

CREATE INDEX IF NOT EXISTS "PriceCache_updatedAt_idx"
  ON "PriceCache" ("updatedAt");
