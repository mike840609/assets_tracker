-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "RecurringCashTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "note" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextRunDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringCashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringCashTransaction_isActive_nextRunDate_idx" ON "RecurringCashTransaction"("isActive", "nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringCashTransaction_accountId_idx" ON "RecurringCashTransaction"("accountId");

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN "recurringId" TEXT,
ADD COLUMN "occurrenceDate" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_recurringId_occurrenceDate_key" ON "CashTransaction"("recurringId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringCashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCashTransaction" ADD CONSTRAINT "RecurringCashTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
