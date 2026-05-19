-- Add account pin + manual ordering support
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Deterministically seed sortOrder per (userId, type) from oldest to newest
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "type"
      ORDER BY "createdAt" ASC, id ASC
    ) - 1 AS row_idx
  FROM "Account"
)
UPDATE "Account" a
SET "sortOrder" = r.row_idx
FROM ranked r
WHERE a.id = r.id;

CREATE INDEX IF NOT EXISTS "Account_userId_isActive_type_isPinned_sortOrder_idx"
  ON "Account" ("userId", "isActive", "type", "isPinned", "sortOrder");
