import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  account: { id: "acc1" } as Record<string, unknown> | null,
  calls: [] as Array<{ op: string; args?: Record<string, unknown> }>,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((fn: () => void) => fn()),
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
    h.calls = [];
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
});
