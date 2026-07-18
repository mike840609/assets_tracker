import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cashRule: null as Record<string, unknown> | null,
  investmentRule: null as Record<string, unknown> | null,
  cashUpdateManyAndReturnCalls: [] as Array<Record<string, unknown>>,
  cashUpdateManyAndReturnCount: 1,
  cashFindUniqueOrThrowCalls: [] as Array<Record<string, unknown>>,
  investmentUpdateManyAndReturnCalls: [] as Array<Record<string, unknown>>,
  investmentUpdateManyAndReturnCount: 1,
  investmentFindUniqueOrThrowCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown, userId: string) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recurringCashTransaction: {
      findFirst: vi.fn(async () => h.cashRule),
      updateManyAndReturn: vi.fn(async (args: Record<string, unknown>) => {
        h.cashUpdateManyAndReturnCalls.push(args);
        return h.cashUpdateManyAndReturnCount === 0
          ? []
          : [{ ...h.cashRule, ...(args.data as Record<string, unknown>) }];
      }),
      findUniqueOrThrow: vi.fn(async (args: Record<string, unknown>) => {
        h.cashFindUniqueOrThrowCalls.push(args);
        return h.cashRule;
      }),
    },
    recurringInvestment: {
      findFirst: vi.fn(async () => h.investmentRule),
      updateManyAndReturn: vi.fn(async (args: Record<string, unknown>) => {
        h.investmentUpdateManyAndReturnCalls.push(args);
        return h.investmentUpdateManyAndReturnCount === 0
          ? []
          : [{ ...h.investmentRule, ...(args.data as Record<string, unknown>) }];
      }),
      findUniqueOrThrow: vi.fn(async (args: Record<string, unknown>) => {
        h.investmentFindUniqueOrThrowCalls.push(args);
        return h.investmentRule;
      }),
    },
  },
}));

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const params = (recurringId: string) => ({
  params: Promise.resolve({ id: "acc1", recurringId }),
});

const jsonRequest = (body: Record<string, unknown>) =>
  new Request("http://unit.test", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

function recurringCashRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "cash-rule-1",
    accountId: "acc1",
    type: "DEPOSIT",
    amount: 100,
    frequency: "MONTHLY",
    note: null,
    startDate: date("2026-08-01"),
    endDate: date("2026-08-31"),
    nextRunDate: date("2026-08-01"),
    isActive: true,
    createdAt: date("2026-07-01"),
    updatedAt: date("2026-07-01"),
    ...overrides,
  };
}

function recurringInvestmentRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "investment-rule-1",
    accountId: "acc1",
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    assetType: "ETF",
    holdingCurrency: "USD",
    amount: 100,
    frequency: "MONTHLY",
    note: null,
    startDate: date("2026-08-01"),
    endDate: date("2026-08-31"),
    nextRunDate: date("2026-08-01"),
    isActive: true,
    createdAt: date("2026-07-01"),
    updatedAt: date("2026-07-01"),
    ...overrides,
  };
}

describe("recurring rule PATCH routes", () => {
  beforeEach(() => {
    h.cashRule = recurringCashRule();
    h.investmentRule = recurringInvestmentRule();
    h.cashUpdateManyAndReturnCalls = [];
    h.cashUpdateManyAndReturnCount = 1;
    h.cashFindUniqueOrThrowCalls = [];
    h.investmentUpdateManyAndReturnCalls = [];
    h.investmentUpdateManyAndReturnCount = 1;
    h.investmentFindUniqueOrThrowCalls = [];
  });

  it("rejects a cash-rule end date before its persisted start date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ endDate: "2026-07-31" }), params("cash-rule-1"));

    expect(response.status).toBe(400);
    expect(h.cashUpdateManyAndReturnCalls).toHaveLength(0);
  });

  it("rejects a cash-rule start date after its persisted end date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ startDate: "2026-09-01" }), params("cash-rule-1"));

    expect(response.status).toBe(400);
    expect(h.cashUpdateManyAndReturnCalls).toHaveLength(0);
  });

  it("clamps nextRunDate to the next scheduled occurrence when startDate moves into the past", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
    try {
      h.cashRule = recurringCashRule({ endDate: null });
      const { PATCH } =
        await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

      const response = await PATCH(jsonRequest({ startDate: "2026-01-15" }), params("cash-rule-1"));

      expect(response.status).toBe(200);
      const call = h.cashUpdateManyAndReturnCalls[0] as { data: Record<string, unknown> };
      expect(call.data.startDate).toEqual(date("2026-01-15"));
      // Monthly anchored to the 15th, today = 2026-03-20 → next occurrence is
      // 2026-04-15, NOT the past startDate (which would replay Jan–Mar).
      expect(call.data.nextRunDate).toEqual(date("2026-04-15"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps nextRunDate to the next scheduled occurrence for investment rules when startDate moves into the past", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
    try {
      h.investmentRule = recurringInvestmentRule({ endDate: null });
      const { PATCH } =
        await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

      const response = await PATCH(
        jsonRequest({ startDate: "2026-01-15" }),
        params("investment-rule-1"),
      );

      expect(response.status).toBe(200);
      const call = h.investmentUpdateManyAndReturnCalls[0] as { data: Record<string, unknown> };
      expect(call.data.startDate).toEqual(date("2026-01-15"));
      // Monthly anchored to the 15th, today = 2026-03-20 → next occurrence is
      // 2026-04-15, NOT the past startDate (which would replay Jan–Mar).
      expect(call.data.nextRunDate).toEqual(date("2026-04-15"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a cash-rule edit when its date range changed concurrently", async () => {
    h.cashUpdateManyAndReturnCount = 0;
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("cash-rule-1"));

    expect(response.status).toBe(409);
  });

  it("rejects an investment-rule end date before its persisted start date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(
      jsonRequest({ endDate: "2026-07-31" }),
      params("investment-rule-1"),
    );

    expect(response.status).toBe(400);
    expect(h.investmentUpdateManyAndReturnCalls).toHaveLength(0);
  });

  it("rejects an investment-rule start date after its persisted end date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(
      jsonRequest({ startDate: "2026-09-01" }),
      params("investment-rule-1"),
    );

    expect(response.status).toBe(400);
    expect(h.investmentUpdateManyAndReturnCalls).toHaveLength(0);
  });

  it("rejects an investment-rule edit when its date range changed concurrently", async () => {
    h.investmentUpdateManyAndReturnCount = 0;
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("investment-rule-1"));

    expect(response.status).toBe(409);
  });

  it("returns the cash rule from its guarded write without a follow-up read", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("cash-rule-1"));

    expect(response.status).toBe(200);
    expect(h.cashUpdateManyAndReturnCalls).toHaveLength(1);
    expect(h.cashFindUniqueOrThrowCalls).toHaveLength(0);
  });

  it("returns the investment rule from its guarded write without a follow-up read", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("investment-rule-1"));

    expect(response.status).toBe(200);
    expect(h.investmentUpdateManyAndReturnCalls).toHaveLength(1);
    expect(h.investmentFindUniqueOrThrowCalls).toHaveLength(0);
  });
});
