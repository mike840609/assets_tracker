-- Provenance columns: capture information at write time that cannot be
-- backfilled later.

-- Market price per unit at transaction time (null when unknown / legacy rows).
ALTER TABLE "HoldingTransaction" ADD COLUMN "price" DECIMAL(18, 8);

-- Account currency at write time, so changing an account's currency later
-- does not silently reinterpret historical cash flows (null on legacy rows;
-- readers fall back to account.currency).
ALTER TABLE "CashTransaction" ADD COLUMN "currency" TEXT;

-- Money invariants enforced at the database level — the last line of defense
-- behind the app-level guards in lib/services/balance.ts and lib/validators.ts.

ALTER TABLE "Holding"
  ADD CONSTRAINT "holding_quantity_nonnegative" CHECK ("quantity" >= 0);

ALTER TABLE "PriceCache"
  ADD CONSTRAINT "price_cache_price_positive" CHECK ("price" > 0);

ALTER TABLE "ExchangeRate"
  ADD CONSTRAINT "exchange_rate_rate_positive" CHECK ("rate" > 0);
