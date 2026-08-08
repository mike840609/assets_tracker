import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required for recurring CAS integration tests");

const parsedDatabaseUrl = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(parsedDatabaseUrl.hostname) ||
  !parsedDatabaseUrl.pathname.endsWith("_asset_tracker_test")
) {
  throw new Error("Integration tests require a local *_asset_tracker_test database");
}

type AfterRead = () => Promise<void>;
let afterCashRead: AfterRead | undefined;
let afterInvestmentRead: AfterRead | undefined;

const servicePool = new pg.Pool({ connectionString: DATABASE_URL });
const concurrentPool = new pg.Pool({ connectionString: DATABASE_URL });
const serviceBase = new PrismaClient({ adapter: new PrismaPg(servicePool) });
const concurrentPrisma = new PrismaClient({ adapter: new PrismaPg(concurrentPool) });
const servicePrisma = serviceBase.$extends({
  query: {
    recurringCashTransaction: {
      async findMany({ args, query }) {
        const rules = await query(args);
        const hook = afterCashRead;
        afterCashRead = undefined;
        await hook?.();
        return rules;
      },
    },
    recurringInvestment: {
      async findMany({ args, query }) {
        const rules = await query(args);
        const hook = afterInvestmentRead;
        afterInvestmentRead = undefined;
        await hook?.();
        return rules;
      },
    },
  },
});

let materializeDueRecurringTransactions: typeof import("@/lib/services/recurring-cash-service").materializeDueRecurringTransactions;
let materializeDueInvestments: typeof import("@/lib/services/recurring-investment-service").materializeDueInvestments;

const OLD_UPDATED_AT = new Date("2026-06-01T01:00:00.000Z");
const NEW_UPDATED_AT = new Date("2026-06-01T02:00:00.000Z");
const DUE_DATE = new Date("2026-06-10T00:00:00.000Z");
const RUN_DATE = new Date("2026-06-14T00:00:00.000Z");

async function createAccount(options: { demo?: boolean } = {}) {
  const user = await concurrentPrisma.user.create({
    data: { email: `issue660-${crypto.randomUUID()}@unit.test` },
  });
  if (options.demo) {
    await concurrentPrisma.demoWorkspace.create({
      data: {
        userId: user.id,
        visitorHash: `visitor-${crypto.randomUUID()}`,
        creatorHash: `creator-${crypto.randomUUID()}`,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
  }
  return concurrentPrisma.account.create({
    data: {
      userId: user.id,
      name: "Issue 660",
      type: "ASSET",
      category: "BROKERAGE",
      currency: "USD",
      cashBalance: 10_000,
    },
  });
}

async function createCashRule(accountId: string) {
  return concurrentPrisma.recurringCashTransaction.create({
    data: {
      accountId,
      type: "DEPOSIT",
      amount: 100,
      frequency: "MONTHLY",
      startDate: DUE_DATE,
      nextRunDate: DUE_DATE,
      updatedAt: OLD_UPDATED_AT,
    },
  });
}

async function createInvestmentRule(accountId: string) {
  await concurrentPrisma.priceCache.create({
    data: { symbol: "VTI", price: 200, currency: "USD" },
  });
  return concurrentPrisma.recurringInvestment.create({
    data: {
      accountId,
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      assetType: "ETF",
      holdingCurrency: "USD",
      amount: 1000,
      frequency: "MONTHLY",
      startDate: DUE_DATE,
      nextRunDate: DUE_DATE,
      updatedAt: OLD_UPDATED_AT,
    },
  });
}

beforeAll(async () => {
  (globalThis as { prisma?: unknown }).prisma = servicePrisma;
  ({ materializeDueRecurringTransactions } = await import("@/lib/services/recurring-cash-service"));
  ({ materializeDueInvestments } = await import("@/lib/services/recurring-investment-service"));

  await concurrentPrisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION issue660_reject_insert()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'issue660 forced rollback';
    END;
    $$ LANGUAGE plpgsql
  `);
});

beforeEach(async () => {
  afterCashRead = undefined;
  afterInvestmentRead = undefined;
  await concurrentPrisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS issue660_reject_cash ON "CashTransaction"`,
  );
  await concurrentPrisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS issue660_reject_holding ON "HoldingTransaction"`,
  );
  await concurrentPrisma.user.deleteMany({
    where: { email: { startsWith: "issue660-" } },
  });
  await concurrentPrisma.priceCache.deleteMany({ where: { symbol: "VTI" } });
});

afterAll(async () => {
  await concurrentPrisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS issue660_reject_cash ON "CashTransaction"`,
  );
  await concurrentPrisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS issue660_reject_holding ON "HoldingTransaction"`,
  );
  await concurrentPrisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS issue660_reject_insert()`);
  await serviceBase.$disconnect();
  await concurrentPrisma.$disconnect();
  await servicePool.end();
  await concurrentPool.end();
  delete (globalThis as { prisma?: unknown }).prisma;
});

describe("recurring materializer CAS races", () => {
  it("cash: a stale read cannot post or reactivate a concurrently disabled rule", async () => {
    const account = await createAccount();
    const rule = await createCashRule(account.id);
    afterCashRead = async () => {
      await concurrentPrisma.recurringCashTransaction.update({
        where: { id: rule.id },
        data: { isActive: false, updatedAt: NEW_UPDATED_AT },
      });
    };

    const result = await materializeDueRecurringTransactions(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, transactions] = await Promise.all([
      concurrentPrisma.recurringCashTransaction.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.cashTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(persistedRule.isActive).toBe(false);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
  });

  it("cash: a stale read cannot post an amount changed concurrently", async () => {
    const account = await createAccount();
    const rule = await createCashRule(account.id);
    afterCashRead = async () => {
      await concurrentPrisma.recurringCashTransaction.update({
        where: { id: rule.id },
        data: { amount: 250, updatedAt: NEW_UPDATED_AT },
      });
    };

    const result = await materializeDueRecurringTransactions(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, transactions] = await Promise.all([
      concurrentPrisma.recurringCashTransaction.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.cashTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(Number(persistedRule.amount)).toBe(250);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
  });

  it("DCA: a stale read cannot buy or reactivate a concurrently disabled rule", async () => {
    const account = await createAccount();
    const rule = await createInvestmentRule(account.id);
    afterInvestmentRead = async () => {
      await concurrentPrisma.recurringInvestment.update({
        where: { id: rule.id },
        data: { isActive: false, updatedAt: NEW_UPDATED_AT },
      });
    };

    const result = await materializeDueInvestments(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, holdings, transactions] = await Promise.all([
      concurrentPrisma.recurringInvestment.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.holding.findMany({ where: { accountId: account.id } }),
      concurrentPrisma.holdingTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(holdings).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(persistedRule.isActive).toBe(false);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
  });

  it("DCA: a stale read cannot buy with an amount changed concurrently", async () => {
    const account = await createAccount();
    const rule = await createInvestmentRule(account.id);
    afterInvestmentRead = async () => {
      await concurrentPrisma.recurringInvestment.update({
        where: { id: rule.id },
        data: { amount: 2500, updatedAt: NEW_UPDATED_AT },
      });
    };

    const result = await materializeDueInvestments(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, holdings, transactions] = await Promise.all([
      concurrentPrisma.recurringInvestment.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.holding.findMany({ where: { accountId: account.id } }),
      concurrentPrisma.holdingTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(holdings).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(Number(persistedRule.amount)).toBe(2500);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
  });
});

describe("recurring materializer Demo isolation", () => {
  it("cash: excludes an explicitly requested Demo rule at the database boundary", async () => {
    const account = await createAccount({ demo: true });
    const rule = await createCashRule(account.id);

    const result = await materializeDueRecurringTransactions(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, transactions] = await Promise.all([
      concurrentPrisma.recurringCashTransaction.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.cashTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 0 });
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
  });

  it("DCA: excludes an explicitly requested Demo rule at the database boundary", async () => {
    const account = await createAccount({ demo: true });
    const rule = await createInvestmentRule(account.id);

    const result = await materializeDueInvestments(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, holdings, transactions] = await Promise.all([
      concurrentPrisma.recurringInvestment.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.holding.findMany({ where: { accountId: account.id } }),
      concurrentPrisma.holdingTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 0 });
    expect(holdings).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
  });
});

describe("recurring materializer transaction rollback", () => {
  it("cash: rolls back the reservation and balance when posting fails", async () => {
    const account = await createAccount();
    const rule = await createCashRule(account.id);
    await concurrentPrisma.$executeRawUnsafe(`
      CREATE CONSTRAINT TRIGGER issue660_reject_cash
      AFTER INSERT ON "CashTransaction"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION issue660_reject_insert()
    `);

    const result = await materializeDueRecurringTransactions(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, transactions] = await Promise.all([
      concurrentPrisma.recurringCashTransaction.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.cashTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
    expect(persistedRule.isActive).toBe(true);
  });

  it("DCA: rolls back the reservation, holding, quantity, and balance when posting fails", async () => {
    const account = await createAccount();
    const rule = await createInvestmentRule(account.id);
    await concurrentPrisma.$executeRawUnsafe(`
      CREATE CONSTRAINT TRIGGER issue660_reject_holding
      AFTER INSERT ON "HoldingTransaction"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION issue660_reject_insert()
    `);

    const result = await materializeDueInvestments(RUN_DATE, rule.id);

    const [persistedRule, persistedAccount, holdings, transactions] = await Promise.all([
      concurrentPrisma.recurringInvestment.findUniqueOrThrow({ where: { id: rule.id } }),
      concurrentPrisma.account.findUniqueOrThrow({ where: { id: account.id } }),
      concurrentPrisma.holding.findMany({ where: { accountId: account.id } }),
      concurrentPrisma.holdingTransaction.findMany({ where: { recurringId: rule.id } }),
    ]);
    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(holdings).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(Number(persistedAccount.cashBalance)).toBe(10_000);
    expect(persistedRule.nextRunDate).toEqual(DUE_DATE);
    expect(persistedRule.isActive).toBe(true);
  });
});
