-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "cashBalance" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "CashTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "Holding" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "HoldingTransaction" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(28,8),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "NetWorthSnapshot" ALTER COLUMN "totalAssets" SET DATA TYPE DECIMAL(28,2),
ALTER COLUMN "totalLiabilities" SET DATA TYPE DECIMAL(28,2),
ALTER COLUMN "netWorth" SET DATA TYPE DECIMAL(28,2);

-- AlterTable
ALTER TABLE "PriceCache" ALTER COLUMN "price" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "RecurringCashTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "RecurringInvestment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(28,8);

-- AlterTable
ALTER TABLE "StockWatchItem" ALTER COLUMN "recordPrice" SET DATA TYPE DECIMAL(28,8);
