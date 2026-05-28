-- Store snapshot freshness timestamps as real instants.
-- Existing values were written from JS Date values into TIMESTAMP columns,
-- so interpret the stored wall-clock values as UTC while converting.

ALTER TABLE "NetWorthSnapshot"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';
