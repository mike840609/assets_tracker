-- CreateIndex
CREATE INDEX IF NOT EXISTS "NetWorthSnapshot_userId_baseCurrency_idx" ON "NetWorthSnapshot"("userId", "baseCurrency");
