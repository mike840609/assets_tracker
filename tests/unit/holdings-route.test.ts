import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  account: { id: "acc1" } as Record<string, unknown> | null,
  afterTasks: [] as Array<() => void | Promise<void>>,
  calls: [] as Array<{ op: string; args?: Record<string, unknown> }>,
  existingHolding: null as Record<string, unknown> | null,
  updateError: null as Error | null,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

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

vi.mock("@/lib/services/price-service", () => ({
  fetchStockPrices: vi.fn(async () => new Map()),
  fetchCryptoPrices: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    account: {
      findUnique: vi.fn(async () => h.account),
    },
    holding: {
      findFirst: vi.fn(async () => h.existingHolding),
      update: vi.fn(async (args: Record<string, unknown>) => {
        if (h.updateError) throw h.updateError;
        h.calls.push({ op: "holding.update", args });
        return { ...h.existingHolding, ...(args.data as Record<string, unknown>) };
      }),
      upsert: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holding.upsert", args });
        return {
          id: "holding1",
          symbol: "AAPL",
          name: "Apple",
          quantity: 10,
          currency: "USD",
          assetType: "STOCK",
        };
      }),
    },
    holdingTransaction: {
      create: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holdingTransaction.create", args });
        return { id: "tx1", ...(args.data as Record<string, unknown>) };
      }),
    },
    priceCache: {
      upsert: vi.fn(),
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

const params = { params: Promise.resolve({ id: "acc1" }) };

const jsonRequest = (body: Record<string, unknown>) =>
  new Request("http://unit.test/api/accounts/acc1/holdings", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("holdings route", () => {
  beforeEach(() => {
    h.account = { id: "acc1" };
    h.afterTasks = [];
    h.calls = [];
    h.existingHolding = null;
    h.updateError = null;
    vi.clearAllMocks();
  });

  it("writes optional unitPrice to the initial BUY transaction", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/holdings/route");

    const response = await POST(
      jsonRequest({
        symbol: "aapl",
        name: "Apple",
        quantity: 10,
        assetType: "STOCK",
        currency: "USD",
        unitPrice: 180.25,
      }),
      params,
    );

    expect(response.status).toBe(201);
    expect(h.calls.find((call) => call.op === "holding.upsert")?.args?.create).toMatchObject({
      accountId: "acc1",
      symbol: "AAPL",
      name: "Apple",
      quantity: 10,
      currency: "USD",
      assetType: "STOCK",
    });
    expect(h.calls.find((call) => call.op === "holding.upsert")?.args?.create).not.toHaveProperty(
      "unitPrice",
    );
    expect(h.calls.find((call) => call.op === "holdingTransaction.create")?.args?.data).toEqual({
      holdingId: "holding1",
      type: "BUY",
      quantity: 10,
      unitPrice: 180.25,
    });
  });

  it("omits unitPrice from the BUY transaction when not provided", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/holdings/route");

    const response = await POST(
      jsonRequest({
        symbol: "aapl",
        name: "Apple",
        quantity: 10,
        assetType: "STOCK",
        currency: "USD",
      }),
      params,
    );

    expect(response.status).toBe(201);
    const data = h.calls.find((call) => call.op === "holdingTransaction.create")?.args?.data as
      | Record<string, unknown>
      | undefined;
    expect(data).toMatchObject({ holdingId: "holding1", type: "BUY", quantity: 10 });
    expect(data).not.toHaveProperty("unitPrice");
  });

  it("schedules price cache warming after returning the created holding", async () => {
    const { fetchStockPrices } = await import("@/lib/services/price-service");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(fetchStockPrices).mockResolvedValueOnce(
      new Map([["AAPL", { price: 180.25, currency: "USD" }]]),
    );
    const { POST } = await import("@/app/api/accounts/[id]/holdings/route");

    const response = await POST(
      jsonRequest({
        symbol: "aapl",
        name: "Apple",
        quantity: 10,
        assetType: "STOCK",
        currency: "USD",
      }),
      params,
    );

    expect(response.status).toBe(201);
    expect(fetchStockPrices).not.toHaveBeenCalled();
    expect(prisma.priceCache.upsert).not.toHaveBeenCalled();

    await h.afterTasks[0]();

    expect(fetchStockPrices).toHaveBeenCalledWith(["AAPL"]);
    expect(prisma.priceCache.upsert).toHaveBeenCalledWith({
      where: { symbol: "AAPL" },
      update: { price: 180.25, currency: "USD", updatedAt: expect.any(Date) },
      create: { symbol: "AAPL", price: 180.25, currency: "USD" },
    });
  });

  it("warms the price cache for the new symbol when a holding is renamed", async () => {
    h.existingHolding = {
      id: "h1",
      symbol: "OLD",
      name: "Old Corp",
      quantity: 5,
      currency: "USD",
      assetType: "STOCK",
    };
    const { fetchStockPrices } = await import("@/lib/services/price-service");
    vi.mocked(fetchStockPrices).mockResolvedValueOnce(
      new Map([["NEW", { price: 42, currency: "USD" }]]),
    );
    const { PATCH } = await import("@/app/api/accounts/[id]/holdings/route");

    const response = await PATCH(
      new Request("http://unit.test", {
        method: "PATCH",
        body: JSON.stringify({ id: "h1", symbol: "NEW" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "acc1" }) },
    );

    expect(response.status).toBe(200);
    for (const task of h.afterTasks) await task();
    expect(vi.mocked(fetchStockPrices)).toHaveBeenCalledWith(["NEW"]);
    const { prisma } = await import("@/lib/prisma");
    expect(vi.mocked(prisma.priceCache.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { symbol: "NEW" } }),
    );
  });

  it("maps a P2002 symbol conflict on PATCH to a 409", async () => {
    const { Prisma } = await import("@/generated/prisma/client");
    const { PATCH } = await import("@/app/api/accounts/[id]/holdings/route");

    h.existingHolding = { id: "holding1", quantity: 10, assetType: "STOCK" };
    h.updateError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });

    const response = await PATCH(
      new Request("http://unit.test/api/accounts/acc1/holdings", {
        method: "PATCH",
        body: JSON.stringify({ id: "holding1", symbol: "MSFT" }),
        headers: { "content-type": "application/json" },
      }),
      params,
    );

    expect(response.status).toBe(409);
  });
});
