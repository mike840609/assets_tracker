import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  cashTransactionCreates: [] as Array<Record<string, unknown>>,
  afterTasks: [] as Array<() => void | Promise<void>>,
}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((fn: () => void | Promise<void>) => {
      h.afterTasks.push(fn);
    }),
  };
});

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown, userId: string) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1"),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    account: {
      aggregate: vi.fn(async () => ({ _max: { sortOrder: 0 } })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "acc1",
        ...args.data,
      })),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    cashTransaction: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        h.cashTransactionCreates.push(args.data);
        return { id: "tx1", ...args.data };
      }),
    },
    exchangeRate: {
      findFirst: vi.fn(async () => ({ fromCurrency: "USD" })),
    },
    $transaction: vi.fn(async (work: unknown) =>
      (work as (tx: typeof prisma) => Promise<unknown>)(prisma),
    ),
  };
  return { prisma };
});

const postRequest = (body: Record<string, unknown>) =>
  new Request("http://unit.test/api/accounts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("accounts POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.cashTransactionCreates = [];
    h.afterTasks = [];
  });

  it("logs an opening-balance EDIT transaction for a nonzero starting balance", async () => {
    const { POST } = await import("@/app/api/accounts/route");

    const response = await POST(
      postRequest({
        name: "Bank",
        type: "ASSET",
        category: "BANK",
        currency: "USD",
        cashBalance: 5000,
      }),
      {},
    );

    expect(response.status).toBe(201);
    expect(h.cashTransactionCreates).toEqual([
      expect.objectContaining({
        accountId: "acc1",
        type: "EDIT",
        amount: 5000,
        note: "Opening balance",
      }),
    ]);
  });

  it("writes no ledger row for a zero starting balance", async () => {
    const { POST } = await import("@/app/api/accounts/route");

    const response = await POST(
      postRequest({ name: "Bank", type: "ASSET", category: "BANK", currency: "USD" }),
      {},
    );

    expect(response.status).toBe(201);
    expect(h.cashTransactionCreates).toEqual([]);
  });
});
