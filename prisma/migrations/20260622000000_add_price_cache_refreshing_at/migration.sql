-- Add refreshingAt claim column to PriceCache for concurrent refresh tracking
ALTER TABLE "PriceCache" ADD COLUMN "refreshingAt" TIMESTAMP(3);
