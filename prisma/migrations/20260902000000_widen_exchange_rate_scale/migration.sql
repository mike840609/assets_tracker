-- AlterTable
-- DECIMAL(18, 8) -> DECIMAL(28, 16) keeps every stored value, but the scale
-- changes (8 -> 16), so unlike a same-scale widening PostgreSQL rewrites the
-- table and holds ACCESS EXCLUSIVE on it for the duration. ExchangeRate holds
-- one row per currency pair, so that is a brief lock in practice.
-- Why the scale has to grow: every refresh also persists the inverse
-- (1 / rate); at 8 decimals a very weak currency (LBP ~89,500/USD, IRR) rounded
-- to 0.00001117, ~0.3% off, and resolveRate prefers that direct row.
ALTER TABLE "ExchangeRate" ALTER COLUMN "rate" TYPE DECIMAL(28, 16);
