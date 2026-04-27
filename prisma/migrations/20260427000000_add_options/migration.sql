-- Add OPTION value to the existing HoldingAssetType enum
ALTER TYPE "HoldingAssetType" ADD VALUE 'OPTION';

-- Create OptionType enum for call/put discrimination
CREATE TYPE "OptionType" AS ENUM ('CALL', 'PUT');

-- Add option-specific columns to Holding (all nullable — non-options rows stay NULL)
ALTER TABLE "Holding" ADD COLUMN "underlyingSymbol" TEXT;
ALTER TABLE "Holding" ADD COLUMN "optionType"       "OptionType";
ALTER TABLE "Holding" ADD COLUMN "strike"           DECIMAL(18, 4);
ALTER TABLE "Holding" ADD COLUMN "expiration"       DATE;
ALTER TABLE "Holding" ADD COLUMN "contractMultiplier" INTEGER;

-- Index for expiry sweep in the daily cron and for option queries
CREATE INDEX "Holding_assetType_expiration_idx" ON "Holding" ("assetType", "expiration");
