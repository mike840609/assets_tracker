-- Create benchmark history cache table keyed by (symbol, date)
CREATE TABLE "BenchmarkPrice" (
  "symbol" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "close" DECIMAL(18,8) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BenchmarkPrice_pkey" PRIMARY KEY ("symbol", "date")
);

CREATE INDEX "BenchmarkPrice_symbol_date_idx" ON "BenchmarkPrice"("symbol", "date" DESC);
