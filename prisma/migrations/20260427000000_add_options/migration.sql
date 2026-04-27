-- Add OPTION value to the existing HoldingAssetType enum
ALTER TYPE "HoldingAssetType" ADD VALUE IF NOT EXISTS 'OPTION';

-- Create OptionType enum for call/put discrimination
DO $$ BEGIN
  CREATE TYPE "OptionType" AS ENUM ('CALL', 'PUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add option-specific columns to Holding (all nullable — non-options rows stay NULL)
ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "underlyingSymbol" TEXT;
ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "optionType"       "OptionType";
ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "strike"           DECIMAL(18, 4);
ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "expiration"       DATE;
ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "contractMultiplier" INTEGER;

-- Index for expiry sweep in the daily cron and for option queries
CREATE INDEX IF NOT EXISTS "Holding_assetType_expiration_idx" ON "Holding" ("assetType", "expiration");
