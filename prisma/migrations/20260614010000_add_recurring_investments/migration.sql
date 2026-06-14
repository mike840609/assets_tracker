-- CreateTable
CREATE TABLE "RecurringInvestment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "HoldingAssetType" NOT NULL,
    "holdingCurrency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(18,8) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "note" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextRunDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringInvestment_isActive_nextRunDate_idx" ON "RecurringInvestment"("isActive", "nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringInvestment_accountId_idx" ON "RecurringInvestment"("accountId");

-- AlterTable
ALTER TABLE "HoldingTransaction" ADD COLUMN "recurringId" TEXT,
ADD COLUMN "occurrenceDate" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "HoldingTransaction_recurringId_occurrenceDate_key" ON "HoldingTransaction"("recurringId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "HoldingTransaction" ADD CONSTRAINT "HoldingTransaction_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringInvestment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvestment" ADD CONSTRAINT "RecurringInvestment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
