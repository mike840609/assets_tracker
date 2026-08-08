import "server-only";

import type { PreparedDemoFixture } from "@/lib/demo/demo-fixture";
import { DEMO_FALLBACK_PRICES, DEMO_FALLBACK_RATES } from "@/lib/demo/demo-fixture-source";
import type { prisma } from "@/lib/prisma";

type DemoTransactionCallback = Parameters<typeof prisma.$transaction>[0];
type DemoFixtureTransactionClient = Parameters<DemoTransactionCallback>[0];

export async function persistDemoFixture(
  tx: DemoFixtureTransactionClient,
  fixture: PreparedDemoFixture,
) {
  await tx.setting.create({ data: fixture.settings });
  if (fixture.accounts.length > 0) {
    await tx.account.createMany({ data: fixture.accounts });
  }
  if (fixture.recurringCashTransactions.length > 0) {
    await tx.recurringCashTransaction.createMany({ data: fixture.recurringCashTransactions });
  }
  if (fixture.recurringInvestments.length > 0) {
    await tx.recurringInvestment.createMany({ data: fixture.recurringInvestments });
  }
  if (fixture.holdings.length > 0) {
    await tx.holding.createMany({ data: fixture.holdings });
  }
  if (fixture.cashTransactions.length > 0) {
    await tx.cashTransaction.createMany({ data: fixture.cashTransactions });
  }
  if (fixture.holdingTransactions.length > 0) {
    await tx.holdingTransaction.createMany({ data: fixture.holdingTransactions });
  }
  if (fixture.snapshots.length > 0) {
    await tx.netWorthSnapshot.createMany({ data: fixture.snapshots });
  }
  if (fixture.goals.length > 0) {
    await tx.goal.createMany({ data: fixture.goals });
  }
  if (fixture.stockWatchItems.length > 0) {
    await tx.stockWatchItem.createMany({ data: fixture.stockWatchItems });
  }
  if (fixture.calendarEntries.length > 0) {
    await tx.calendarEntry.createMany({ data: fixture.calendarEntries });
  }
  await tx.priceCache.createMany({
    data: DEMO_FALLBACK_PRICES.map((row) => ({ ...row })),
    skipDuplicates: true,
  });
  await tx.exchangeRate.createMany({
    data: DEMO_FALLBACK_RATES.map((row) => ({ ...row })),
    skipDuplicates: true,
  });
  return { rowCount: fixture.rowCount };
}

export async function deleteDemoDomainRows(tx: DemoFixtureTransactionClient, userId: string) {
  await tx.$executeRaw`
    WITH deleted_accounts AS (
      DELETE FROM "Account" WHERE "userId" = ${userId}
    ), deleted_snapshots AS (
      DELETE FROM "NetWorthSnapshot" WHERE "userId" = ${userId}
    ), deleted_goals AS (
      DELETE FROM "Goal" WHERE "userId" = ${userId}
    ), deleted_stocks AS (
      DELETE FROM "StockWatchItem" WHERE "userId" = ${userId}
    ), deleted_settings AS (
      DELETE FROM "Setting" WHERE "userId" = ${userId}
    )
    DELETE FROM "CalendarEntry" WHERE "userId" = ${userId}
  `;
}
