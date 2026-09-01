-- AlterTable
-- Widening only: DECIMAL(18, 8) -> DECIMAL(28, 16) keeps every stored value and
-- rewrites no rows in place beyond the type change. Every refresh also persists
-- the inverse (1 / rate); at 8 decimals a very weak currency (LBP ~89,500/USD,
-- IRR) rounded to 0.00001117, ~0.3% off, and resolveRate prefers that direct row.
ALTER TABLE "ExchangeRate" ALTER COLUMN "rate" TYPE DECIMAL(28, 16);
