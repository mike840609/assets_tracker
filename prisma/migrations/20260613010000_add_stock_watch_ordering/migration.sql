-- Add manual ordering support to the watchlist
ALTER TABLE "StockWatchItem" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Seed sortOrder per user newest-first so the current default order is preserved
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, id ASC
    ) - 1 AS row_idx
  FROM "StockWatchItem"
)
UPDATE "StockWatchItem" s
SET "sortOrder" = r.row_idx
FROM ranked r
WHERE s.id = r.id;

-- Replace the createdAt-only read index with one that backs (sortOrder, createdAt) ordering
DROP INDEX IF EXISTS "StockWatchItem_userId_createdAt_idx";

CREATE INDEX IF NOT EXISTS "StockWatchItem_userId_sortOrder_createdAt_idx"
  ON "StockWatchItem" ("userId", "sortOrder", "createdAt" DESC);
