CREATE TABLE "StockWatchItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "exchange" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "recordPrice" DECIMAL(18, 8) NOT NULL,
  "recordDate" DATE NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockWatchItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockWatchItem_userId_symbol_key"
  ON "StockWatchItem" ("userId", "symbol");

CREATE INDEX "StockWatchItem_userId_createdAt_idx"
  ON "StockWatchItem" ("userId", "createdAt" DESC);

ALTER TABLE "StockWatchItem"
  ADD CONSTRAINT "StockWatchItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
