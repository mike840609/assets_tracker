-- The currency pair already identifies an exchange-rate row.
ALTER TABLE "ExchangeRate" DROP CONSTRAINT IF EXISTS "ExchangeRate_pkey";
DROP INDEX IF EXISTS "ExchangeRate_fromCurrency_toCurrency_key";

ALTER TABLE "ExchangeRate" DROP COLUMN IF EXISTS "id";

ALTER TABLE "ExchangeRate"
  ADD CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("fromCurrency", "toCurrency");
