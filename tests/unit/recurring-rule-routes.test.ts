import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cashRule: null as Record<string, unknown> | null,
  investmentRule: null as Record<string, unknown> | null,
  cashUpdateCalls: [] as Array<Record<string, unknown>>,
  cashUpdateManyCalls: [] as Array<Record<string, unknown>>,
  cashUpdateManyCount: 1,
  investmentUpdateCalls: [] as Array<Record<string, unknown>>,
  investmentUpdateManyCalls: [] as Array<Record<string, unknown>>,
  investmentUpdateManyCount: 1,
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
      update: vi.fn(async (args: Record<string, unknown>) => {
        h.cashUpdateCalls.push(args);
        return { ...h.cashRule, ...(args.data as Record<string, unknown>) };
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        h.cashUpdateManyCalls.push(args);
        return { count: h.cashUpdateManyCount };
      }),
      findUniqueOrThrow: vi.fn(async () => h.cashRule),
    },
    recurringInvestment: {
      findFirst: vi.fn(async () => h.investmentRule),
      update: vi.fn(async (args: Record<string, unknown>) => {
        h.investmentUpdateCalls.push(args);
        return { ...h.investmentRule, ...(args.data as Record<string, unknown>) };
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        h.investmentUpdateManyCalls.push(args);
        return { count: h.investmentUpdateManyCount };
      }),
      findUniqueOrThrow: vi.fn(async () => h.investmentRule),
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
    h.cashUpdateCalls = [];
    h.cashUpdateManyCalls = [];
    h.cashUpdateManyCount = 1;
    h.investmentUpdateCalls = [];
    h.investmentUpdateManyCalls = [];
    h.investmentUpdateManyCount = 1;
  });

  it("rejects a cash-rule end date before its persisted start date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ endDate: "2026-07-31" }), params("cash-rule-1"));

    expect(response.status).toBe(400);
    expect(h.cashUpdateCalls).toHaveLength(0);
  });

  it("rejects a cash-rule start date after its persisted end date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ startDate: "2026-09-01" }), params("cash-rule-1"));

    expect(response.status).toBe(400);
    expect(h.cashUpdateCalls).toHaveLength(0);
  });

  it("rejects a cash-rule edit when its date range changed concurrently", async () => {
    h.cashUpdateManyCount = 0;
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
    expect(h.investmentUpdateCalls).toHaveLength(0);
  });

  it("rejects an investment-rule start date after its persisted end date", async () => {
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(
      jsonRequest({ startDate: "2026-09-01" }),
      params("investment-rule-1"),
    );

    expect(response.status).toBe(400);
    expect(h.investmentUpdateCalls).toHaveLength(0);
  });

  it("rejects an investment-rule edit when its date range changed concurrently", async () => {
    h.investmentUpdateManyCount = 0;
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("investment-rule-1"));

    expect(response.status).toBe(409);
  });
});
