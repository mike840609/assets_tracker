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
  materializeCash: vi.fn(async (_now?: Date, _ruleId?: string) => ({
    created: 1,
    rulesProcessed: 1,
  })),
  materializeInvestment: vi.fn(async (_now?: Date, _ruleId?: string) => ({
    created: 1,
    rulesProcessed: 1,
  })),
  revalidatedTags: [] as string[],
  afterTasks: [] as Array<() => void | Promise<void>>,
  principal: { kind: "formal" as const, userId: "user1" } as
    | { kind: "formal"; userId: string }
    | { kind: "demo"; userId: string; expiresAt: Date },
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn((tag: string) => {
    h.revalidatedTags.push(tag);
  }),
  cacheTag: () => {},
  cacheLife: () => {},
  unstable_cache: <T>(fn: T) => fn,
}));

vi.mock("@/lib/services/recurring-cash-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/recurring-cash-service")>();
  return { ...actual, materializeDueRecurringTransactions: h.materializeCash };
});

vi.mock("@/lib/services/recurring-investment-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/recurring-investment-service")>();
  return { ...actual, materializeDueInvestments: h.materializeInvestment };
});

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (
      handler: (
        req: Request,
        ctx: unknown,
        userId: string,
        principal: typeof h.principal,
      ) => Promise<Response>,
    ) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1", h.principal),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((task: () => void | Promise<void>) => h.afterTasks.push(task)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: { findUnique: vi.fn(async () => ({ id: "acc1" })) },
    recurringCashTransaction: {
      findFirst: vi.fn(async () => h.cashRule),
      findUnique: vi.fn(async () => h.cashRule),
      create: vi.fn(
        async (args: { data: Record<string, unknown> }) =>
          ({ ...h.cashRule, ...args.data, id: "cash-new" }) as Record<string, unknown>,
      ),
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
      findUnique: vi.fn(async () => h.investmentRule),
      create: vi.fn(
        async (args: { data: Record<string, unknown> }) =>
          ({ ...h.investmentRule, ...args.data, id: "investment-new" }) as Record<string, unknown>,
      ),
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
    h.afterTasks = [];
    h.principal = { kind: "formal", userId: "user1" };
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

  it("rejects a cash-rule edit when its amount changed concurrently", async () => {
    h.cashUpdateManyAndReturnCount = 0;
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("cash-rule-1"));

    expect(response.status).toBe(409);
    const call = h.cashUpdateManyAndReturnCalls[0] as { where: Record<string, unknown> };
    expect(call.where.updatedAt).toEqual(date("2026-07-01"));
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

  it("rejects an investment-rule edit when it was disabled concurrently", async () => {
    h.investmentUpdateManyAndReturnCount = 0;
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }), params("investment-rule-1"));

    expect(response.status).toBe(409);
    const call = h.investmentUpdateManyAndReturnCalls[0] as { where: Record<string, unknown> };
    expect(call.where.updatedAt).toEqual(date("2026-07-01"));
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

describe("recurring rule POST/PATCH materialization", () => {
  beforeEach(() => {
    h.cashRule = recurringCashRule();
    h.investmentRule = recurringInvestmentRule();
    h.materializeCash.mockClear();
    h.materializeCash.mockResolvedValue({ created: 1, rulesProcessed: 1 });
    h.materializeInvestment.mockClear();
    h.materializeInvestment.mockResolvedValue({ created: 1, rulesProcessed: 1 });
    h.revalidatedTags = [];
    h.afterTasks = [];
    h.principal = { kind: "formal", userId: "user1" };
  });

  const postRequest = (body: Record<string, unknown>) =>
    new Request("http://unit.test", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  const postParams = { params: Promise.resolve({ id: "acc1" }) };

  it("POST schedules due cash materialization for formal users", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/recurring-cash-transactions/route");

    const response = await POST(
      postRequest({ type: "DEPOSIT", amount: 100, frequency: "MONTHLY", startDate: "2026-07-01" }),
      postParams,
    );

    expect(response.status).toBe(201);
    expect(h.materializeCash).not.toHaveBeenCalled();
    expect(h.afterTasks).toHaveLength(1);
    await h.afterTasks[0]();
    expect(h.materializeCash).toHaveBeenCalledTimes(1);
    expect(h.materializeCash.mock.calls[0][1]).toBe("cash-new");
    expect(h.revalidatedTags).toEqual(
      expect.arrayContaining(["accounts:user1", "net-worth:user1", "history:user1"]),
    );
  });

  it("POST does not materialize a future-dated cash rule", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/recurring-cash-transactions/route");

    const response = await POST(
      postRequest({ type: "DEPOSIT", amount: 100, frequency: "MONTHLY", startDate: "2100-01-01" }),
      postParams,
    );

    expect(response.status).toBe(201);
    expect(h.materializeCash).not.toHaveBeenCalled();
    expect(h.afterTasks).toHaveLength(0);
  });

  it("POST still succeeds when materialization throws", async () => {
    h.materializeCash.mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("@/app/api/accounts/[id]/recurring-cash-transactions/route");

    const response = await POST(
      postRequest({ type: "DEPOSIT", amount: 100, frequency: "MONTHLY", startDate: "2026-07-01" }),
      postParams,
    );

    expect(response.status).toBe(201);
  });

  it("POST schedules due investment materialization for formal users", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/recurring-investments/route");

    const response = await POST(
      postRequest({
        symbol: "VTI",
        name: "Vanguard Total Stock Market ETF",
        assetType: "ETF",
        holdingCurrency: "USD",
        amount: 100,
        frequency: "MONTHLY",
        startDate: "2026-07-01",
      }),
      postParams,
    );

    expect(response.status).toBe(201);
    expect(h.materializeInvestment).not.toHaveBeenCalled();
    expect(h.afterTasks).toHaveLength(1);
    await h.afterTasks[0]();
    expect(h.materializeInvestment).toHaveBeenCalledTimes(1);
    expect(h.materializeInvestment.mock.calls[0][1]).toBe("investment-new");
    expect(h.revalidatedTags).toEqual(expect.arrayContaining(["prices"]));
  });

  it("PATCH schedules a cash rule that became due for formal users", async () => {
    h.cashRule = recurringCashRule({
      isActive: false,
      startDate: date("2026-07-01"),
      nextRunDate: date("2026-07-01"),
      endDate: null,
    });
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const response = await PATCH(jsonRequest({ isActive: true }), params("cash-rule-1"));

    expect(response.status).toBe(200);
    expect(h.materializeCash).not.toHaveBeenCalled();
    expect(h.afterTasks).toHaveLength(1);
    await h.afterTasks[0]();
    expect(h.materializeCash).toHaveBeenCalledTimes(1);
    expect(h.materializeCash.mock.calls[0][1]).toBe("cash-rule-1");
  });

  it("PATCH schedules an investment rule that became due for formal users", async () => {
    h.investmentRule = recurringInvestmentRule({
      isActive: false,
      startDate: date("2026-07-01"),
      nextRunDate: date("2026-07-01"),
      endDate: null,
    });
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const response = await PATCH(jsonRequest({ isActive: true }), params("investment-rule-1"));

    expect(response.status).toBe(200);
    expect(h.materializeInvestment).not.toHaveBeenCalled();
    expect(h.afterTasks).toHaveLength(1);
    await h.afterTasks[0]();
    expect(h.materializeInvestment).toHaveBeenCalledTimes(1);
    expect(h.materializeInvestment.mock.calls[0][1]).toBe("investment-rule-1");
  });

  it("does not schedule due cash materialization after Demo create or update", async () => {
    h.principal = {
      kind: "demo",
      userId: "user1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { POST } = await import("@/app/api/accounts/[id]/recurring-cash-transactions/route");
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route");

    const created = await POST(
      postRequest({ type: "DEPOSIT", amount: 100, frequency: "MONTHLY", startDate: "2026-07-01" }),
      postParams,
    );
    h.cashRule = recurringCashRule({
      isActive: false,
      startDate: date("2026-07-01"),
      nextRunDate: date("2026-07-01"),
      endDate: null,
    });
    const updated = await PATCH(jsonRequest({ isActive: true }), params("cash-rule-1"));

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(h.afterTasks).toHaveLength(0);
    expect(h.materializeCash).not.toHaveBeenCalled();
  });

  it("does not schedule due investment materialization after Demo create or update", async () => {
    h.principal = {
      kind: "demo",
      userId: "user1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { POST } = await import("@/app/api/accounts/[id]/recurring-investments/route");
    const { PATCH } =
      await import("@/app/api/accounts/[id]/recurring-investments/[recurringId]/route");

    const created = await POST(
      postRequest({
        symbol: "VTI",
        name: "Vanguard Total Stock Market ETF",
        assetType: "ETF",
        holdingCurrency: "USD",
        amount: 100,
        frequency: "MONTHLY",
        startDate: "2026-07-01",
      }),
      postParams,
    );
    h.investmentRule = recurringInvestmentRule({
      isActive: false,
      startDate: date("2026-07-01"),
      nextRunDate: date("2026-07-01"),
      endDate: null,
    });
    const updated = await PATCH(jsonRequest({ isActive: true }), params("investment-rule-1"));

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(h.afterTasks).toHaveLength(0);
    expect(h.materializeInvestment).not.toHaveBeenCalled();
  });
});
