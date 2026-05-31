-- Remove the separate market direction color preference.
-- Gain/loss tokens now follow the active color schema instead.

ALTER TABLE "Setting"
  DROP COLUMN IF EXISTS "stockColorScheme";

DROP TYPE IF EXISTS "StockColorScheme";
