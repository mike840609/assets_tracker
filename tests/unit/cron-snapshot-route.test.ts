import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  events: [] as string[],
  expiredOptions: [] as Array<{ id: string; quantity: number }>,
}));

vi.mock("@/lib/env", () => ({
  CRON_SECRET: "test-secret",
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn((tag: string) => {
    h.events.push(`revalidate:${tag}`);
  }),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

vi.mock("@/lib/sentry-cron", () => ({
  startSnapshotCronCheckIn: vi.fn(() => "check-in"),
  finishSnapshotCronCheckIn: vi.fn(),
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(async () => ({ updated: 0, changed: 0 })),
}));

vi.mock("@/lib/services/price-service", () => ({
  refreshAllPrices: vi.fn(async () => ({ updated: 0, changed: 0 })),
}));

vi.mock("@/lib/services/recurring-cash-service", () => ({
  materializeDueRecurringTransactions: vi.fn(async () => ({ created: 0, rulesProcessed: 0 })),
}));

vi.mock("@/lib/services/recurring-investment-service", () => ({
  materializeDueInvestments: vi.fn(async () => ({ created: 0, rulesProcessed: 0 })),
}));

vi.mock("@/lib/services/snapshot-service", () => ({
  createSnapshot: vi.fn(async () => {
    h.events.push("snapshot");
    return { id: "snapshot1" };
  }),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    cronRun: {
      create: vi.fn(async () => ({ id: "cron1" })),
      update: vi.fn(async () => ({})),
    },
    holding: {
      findMany: vi.fn(async () => h.expiredOptions),
      updateMany: vi.fn(async () => ({ count: h.expiredOptions.length })),
    },
    holdingTransaction: {
      createMany: vi.fn(async () => ({ count: h.expiredOptions.length })),
    },
    account: {
      findMany: vi.fn(async () => []),
    },
    setting: {
      findMany: vi.fn(async () => []),
    },
    user: {
      findMany: vi.fn(async () => [{ id: "user1", appSettings: { baseCurrency: "USD" } }]),
    },
    $transaction: vi.fn(async (work: unknown) => {
      if (Array.isArray(work)) return Promise.all(work);
      return (work as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }),
  };
  return { prisma };
});

describe("snapshot cron route", () => {
  beforeEach(() => {
    h.events = [];
    h.expiredOptions = [];
  });

  it("invalidates net worth before snapshot creation when options expire", async () => {
    h.expiredOptions = [{ id: "holding1", quantity: 2 }];
    const { GET } = await import("@/app/api/cron/snapshot/route");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(h.events).toContain("revalidate:accounts");
    expect(h.events).toContain("revalidate:net-worth");
    expect(h.events.indexOf("revalidate:net-worth")).toBeLessThan(h.events.indexOf("snapshot"));
  });
});
