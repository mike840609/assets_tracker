import { describe, it, expect, beforeEach, vi } from "vitest";

// The service module imports prisma + logger at top level; mock both so the
// pure date helpers can be imported in the Node test env. The materialization
// tests drive the mocked prisma below.
const h = vi.hoisted(() => ({
  dueRules: [] as Array<Record<string, unknown>>,
  createManyCalls: [] as Array<{ data: Array<Record<string, unknown>>; skipDuplicates?: boolean }>,
  accountUpdates: [] as Array<{ where: unknown; data: unknown }>,
  ruleUpdates: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
  createManyCount: null as number | null, // override inserted count (null = data.length)
}));

vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recurringCashTransaction: {
      findMany: vi.fn(async () => h.dueRules),
      update: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
        h.ruleUpdates.push(args);
        return {};
      }),
    },
    cashTransaction: {
      createMany: vi.fn(
        async (args: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => {
          h.createManyCalls.push(args);
          return { count: h.createManyCount ?? args.data.length };
        },
      ),
    },
    account: {
      update: vi.fn(async (args: { where: unknown; data: unknown }) => {
        h.accountUpdates.push(args);
        return {};
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Interactive form — hand the same mocked client back as `tx`.
      const { prisma } = await import("@/lib/prisma");
      return fn(prisma);
    }),
  },
}));

import {
  advanceRecurringDate,
  computeDueOccurrences,
  materializeDueRecurringTransactions,
  utcDateOnly,
} from "@/lib/services/recurring-cash-service";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("advanceRecurringDate", () => {
  it("adds 7 / 14 days for weekly / biweekly", () => {
    expect(iso(advanceRecurringDate(d("2026-01-01"), "WEEKLY", 1))).toBe("2026-01-08");
    expect(iso(advanceRecurringDate(d("2026-01-01"), "BIWEEKLY", 1))).toBe("2026-01-15");
  });

  it("advances months/quarters/years anchored to the start day", () => {
    expect(iso(advanceRecurringDate(d("2026-01-15"), "MONTHLY", 15))).toBe("2026-02-15");
    expect(iso(advanceRecurringDate(d("2026-01-15"), "QUARTERLY", 15))).toBe("2026-04-15");
    expect(iso(advanceRecurringDate(d("2026-01-15"), "ANNUAL", 15))).toBe("2027-01-15");
  });

  it("clamps to month length without drifting (Jan 31 -> Feb 28 -> Mar 31)", () => {
    const feb = advanceRecurringDate(d("2026-01-31"), "MONTHLY", 31);
    expect(iso(feb)).toBe("2026-02-28");
    // Anchor stays day 31, so March returns to the 31st rather than the 28th.
    const mar = advanceRecurringDate(feb, "MONTHLY", 31);
    expect(iso(mar)).toBe("2026-03-31");
  });

  it("handles a leap-year February", () => {
    expect(iso(advanceRecurringDate(d("2024-01-31"), "MONTHLY", 31))).toBe("2024-02-29");
  });
});

describe("computeDueOccurrences", () => {
  it("returns a single occurrence when next run is exactly today", () => {
    const { occurrences, nextRunDate } = computeDueOccurrences(
      {
        nextRunDate: d("2026-06-14"),
        startDate: d("2026-06-14"),
        endDate: null,
        frequency: "MONTHLY",
      },
      d("2026-06-14"),
    );
    expect(occurrences.map(iso)).toEqual(["2026-06-14"]);
    expect(iso(nextRunDate)).toBe("2026-07-14");
  });

  it("catches up every missed occurrence since the last run", () => {
    // Weekly rule that last ran 2026-05-01; cron skipped ~6 weeks.
    const { occurrences, nextRunDate } = computeDueOccurrences(
      {
        nextRunDate: d("2026-05-01"),
        startDate: d("2026-05-01"),
        endDate: null,
        frequency: "WEEKLY",
      },
      d("2026-06-14"),
    );
    expect(occurrences.map(iso)).toEqual([
      "2026-05-01",
      "2026-05-08",
      "2026-05-15",
      "2026-05-22",
      "2026-05-29",
      "2026-06-05",
      "2026-06-12",
    ]);
    expect(iso(nextRunDate)).toBe("2026-06-19");
  });

  it("stops at the end date (inclusive)", () => {
    const { occurrences } = computeDueOccurrences(
      {
        nextRunDate: d("2026-01-15"),
        startDate: d("2026-01-15"),
        endDate: d("2026-03-15"),
        frequency: "MONTHLY",
      },
      d("2026-12-31"),
    );
    expect(occurrences.map(iso)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("produces nothing when next run is in the future", () => {
    const { occurrences } = computeDueOccurrences(
      {
        nextRunDate: d("2026-07-01"),
        startDate: d("2026-07-01"),
        endDate: null,
        frequency: "MONTHLY",
      },
      d("2026-06-14"),
    );
    expect(occurrences).toHaveLength(0);
  });

  it("honors the maxOccurrences safety bound", () => {
    const { occurrences } = computeDueOccurrences(
      {
        nextRunDate: d("2020-01-01"),
        startDate: d("2020-01-01"),
        endDate: null,
        frequency: "WEEKLY",
      },
      d("2026-06-14"),
      10,
    );
    expect(occurrences).toHaveLength(10);
  });
});

describe("utcDateOnly", () => {
  it("floors to UTC midnight", () => {
    expect(utcDateOnly(new Date("2026-06-14T23:30:00.000Z")).toISOString()).toBe(
      "2026-06-14T00:00:00.000Z",
    );
  });
});

describe("materializeDueRecurringTransactions", () => {
  beforeEach(() => {
    h.dueRules = [];
    h.createManyCalls = [];
    h.accountUpdates = [];
    h.ruleUpdates = [];
    h.createManyCount = null;
  });

  it("posts due occurrences and increments balance by the signed total", async () => {
    h.dueRules = [
      {
        id: "rule1",
        accountId: "acc1",
        type: "DEPOSIT",
        amount: 100,
        note: "Salary",
        frequency: "WEEKLY",
        startDate: d("2026-06-01"),
        endDate: null,
        nextRunDate: d("2026-06-01"),
      },
    ];
    const result = await materializeDueRecurringTransactions(d("2026-06-14"));

    // 2026-06-01, 06-08 are <= 06-14 (06-15 is the next run).
    expect(result).toEqual({ created: 2, rulesProcessed: 1 });
    expect(h.createManyCalls[0].data).toHaveLength(2);
    expect(h.createManyCalls[0].skipDuplicates).toBe(true);
    // +100 * 2 inserted rows.
    const inc = (h.accountUpdates[0].data as { cashBalance: { increment: unknown } }).cashBalance
      .increment;
    expect(Number(inc)).toBe(200);
    expect(iso(h.ruleUpdates[0].data.nextRunDate as Date)).toBe("2026-06-15");
    expect(h.ruleUpdates[0].data.isActive).toBe(true);
  });

  it("negates the balance delta for withdrawals", async () => {
    h.dueRules = [
      {
        id: "rule2",
        accountId: "acc1",
        type: "WITHDRAWAL",
        amount: 50,
        note: null,
        frequency: "MONTHLY",
        startDate: d("2026-06-10"),
        endDate: null,
        nextRunDate: d("2026-06-10"),
      },
    ];
    await materializeDueRecurringTransactions(d("2026-06-14"));
    const inc = (h.accountUpdates[0].data as { cashBalance: { increment: unknown } }).cashBalance
      .increment;
    expect(Number(inc)).toBe(-50);
  });

  it("increments by inserted count, not occurrence count, when rows are skipped", async () => {
    h.dueRules = [
      {
        id: "rule3",
        accountId: "acc1",
        type: "DEPOSIT",
        amount: 100,
        note: null,
        frequency: "WEEKLY",
        startDate: d("2026-06-01"),
        endDate: null,
        nextRunDate: d("2026-06-01"),
      },
    ];
    h.createManyCount = 1; // simulate one occurrence already existed (idempotent skip)
    const result = await materializeDueRecurringTransactions(d("2026-06-14"));
    expect(result.created).toBe(1);
    const inc = (h.accountUpdates[0].data as { cashBalance: { increment: unknown } }).cashBalance
      .increment;
    expect(Number(inc)).toBe(100);
  });

  it("deactivates an expired rule and posts nothing", async () => {
    h.dueRules = [
      {
        id: "rule4",
        accountId: "acc1",
        type: "DEPOSIT",
        amount: 100,
        note: null,
        frequency: "MONTHLY",
        startDate: d("2026-01-15"),
        endDate: d("2026-03-15"),
        nextRunDate: d("2026-04-15"), // already past endDate
      },
    ];
    const result = await materializeDueRecurringTransactions(d("2026-06-14"));
    expect(result.created).toBe(0);
    expect(h.createManyCalls).toHaveLength(0);
    expect(h.accountUpdates).toHaveLength(0);
    expect(h.ruleUpdates[0].data.isActive).toBe(false);
  });
});
