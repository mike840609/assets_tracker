-- Add per-user stock direction color preference (Western: green=up | East Asian: red=up).
-- Existing rows default to GREEN_UP to preserve current rendering.

CREATE TYPE "StockColorScheme" AS ENUM ('GREEN_UP', 'RED_UP');

ALTER TABLE "Setting"
  ADD COLUMN "stockColorScheme" "StockColorScheme" NOT NULL DEFAULT 'GREEN_UP';
