import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  auth: vi.fn(),
  cacheEquityQuote: vi.fn(),
  consumeMutation: vi.fn(),
  consumeRefresh: vi.fn(),
  fetchEquityQuote: vi.fn(),
  invalidateStockWatchCaches: vi.fn(),
  rateLimitCheckWithPrune: vi.fn(() => null),
  rateLimitKeyForClientIp: vi.fn(() => "hmac:formal-quote"),
  rateLimitKeyForSubject: vi.fn(() => "hmac:demo-quote"),
  resolvePrincipal: vi.fn(),
  stockAggregate: vi.fn(),
  stockCreate: vi.fn(),
  stockFindUnique: vi.fn(),
  tryCacheEquityQuote: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth-principal", () => ({ resolvePrincipal: mocks.resolvePrincipal }));
vi.mock("@/lib/auth-user", () => ({ userExists: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/demo/demo-metrics", () => ({ recordDemoMetric: vi.fn() }));
vi.mock("@/lib/demo/demo-quota-service", () => ({
  consumeDemoMutationQuota: mocks.consumeMutation,
  consumeDemoRefreshQuota: mocks.consumeRefresh,
}));
vi.mock("@/lib/demo/demo-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/demo/demo-service")>()),
  deleteExpiredDemoUser: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ AUTH_SECRET: "unit-test-secret", isPublicDemoEnabled: true }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quotaDb: true,
    stockWatchItem: {
      aggregate: mocks.stockAggregate,
      create: mocks.stockCreate,
      findUnique: mocks.stockFindUnique,
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheckWithPrune: mocks.rateLimitCheckWithPrune,
  rateLimitKeyForClientIp: mocks.rateLimitKeyForClientIp,
  rateLimitKeyForSubject: mocks.rateLimitKeyForSubject,
}));
vi.mock("@/lib/services/stock-watch-service", () => ({
  cacheEquityQuote: mocks.cacheEquityQuote,
  fetchEquityQuote: mocks.fetchEquityQuote,
  invalidateStockWatchCaches: mocks.invalidateStockWatchCaches,
  serializeStockWatchItem: (item: Record<string, unknown>) => item,
  tryCacheEquityQuote: mocks.tryCacheEquityQuote,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

const demoPrincipal = {
  kind: "demo" as const,
  userId: "demo-user",
  expiresAt: new Date("2026-08-02T00:00:00.000Z"),
};

const validStock = {
  symbol: "AAPL",
  name: "Apple",
  exchange: "NASDAQ",
  currency: "USD",
  recordPrice: 190,
  recordDate: "2026-08-01",
};

const quote = {
  symbol: "AAPL",
  name: "Apple",
  exchange: "NASDAQ",
  currency: "USD",
  price: 200,
};

function request(url: string, init?: RequestInit) {
  return new Request(url, init);
}

function callOrder(mock: ReturnType<typeof vi.fn>) {
  const order = mock.mock.invocationCallOrder[0];
  if (order === undefined) throw new Error("Expected mock to be called");
  return order;
}

describe("Demo stock lookup refresh credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "demo-session" } });
    mocks.resolvePrincipal.mockResolvedValue({ status: "active", principal: demoPrincipal });
    mocks.consumeMutation.mockResolvedValue({ ok: true });
    mocks.consumeRefresh.mockResolvedValue({ ok: true });
    mocks.fetchEquityQuote.mockResolvedValue(quote);
    mocks.cacheEquityQuote.mockResolvedValue({
      price: 200,
      currency: "USD",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    mocks.stockFindUnique.mockResolvedValue(null);
    mocks.stockAggregate.mockResolvedValue({ _max: { sortOrder: null } });
    mocks.stockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "watch-1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      ...data,
    }));
    mocks.tryCacheEquityQuote.mockResolvedValue(null);
  });

  it("does not spend a Demo refresh credit for a quote request without a symbol", async () => {
    const { GET } = await import("@/app/api/stocks/quote/route");

    const response = await GET(request("http://unit.test/api/stocks/quote"), undefined);

    expect(response.status).toBe(400);
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
    expect(mocks.fetchEquityQuote).not.toHaveBeenCalled();
  });

  it("does not spend a Demo refresh credit when a stock-create body is invalid JSON", async () => {
    const { POST } = await import("@/app/api/stocks/route");

    await expect(
      POST(
        request("http://unit.test/api/stocks", {
          method: "POST",
          body: "{",
          headers: { "content-type": "application/json" },
        }),
        undefined,
      ),
    ).rejects.toThrow();

    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
    expect(mocks.fetchEquityQuote).not.toHaveBeenCalled();
  });

  it("does not spend a Demo refresh credit when a stock-create body fails schema validation", async () => {
    const { POST } = await import("@/app/api/stocks/route");

    const response = await POST(
      request("http://unit.test/api/stocks", {
        method: "POST",
        body: JSON.stringify({ symbol: "" }),
        headers: { "content-type": "application/json" },
      }),
      undefined,
    );

    expect(response.status).toBe(400);
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
    expect(mocks.fetchEquityQuote).not.toHaveBeenCalled();
  });

  it("does not spend a Demo refresh credit for an exact duplicate stock", async () => {
    mocks.stockFindUnique.mockResolvedValueOnce({ id: "existing-watch" });
    const { POST } = await import("@/app/api/stocks/route");

    const response = await POST(
      request("http://unit.test/api/stocks", {
        method: "POST",
        body: JSON.stringify(validStock),
        headers: { "content-type": "application/json" },
      }),
      undefined,
    );

    expect(response.status).toBe(409);
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
    expect(mocks.fetchEquityQuote).not.toHaveBeenCalled();
  });

  it("spends one Demo refresh credit immediately before a valid quote provider call", async () => {
    const { GET } = await import("@/app/api/stocks/quote/route");

    const response = await GET(request("http://unit.test/api/stocks/quote?symbol=AAPL"), undefined);

    expect(response.status).toBe(200);
    expect(mocks.consumeRefresh).toHaveBeenCalledOnce();
    expect(mocks.fetchEquityQuote).toHaveBeenCalledOnce();
    expect(callOrder(mocks.consumeRefresh)).toBeLessThan(callOrder(mocks.fetchEquityQuote));
  });

  it("spends mutation then one Demo refresh credit before a valid stock-create provider call", async () => {
    const { POST } = await import("@/app/api/stocks/route");

    const response = await POST(
      request("http://unit.test/api/stocks", {
        method: "POST",
        body: JSON.stringify(validStock),
        headers: { "content-type": "application/json" },
      }),
      undefined,
    );

    expect(response.status).toBe(201);
    expect(mocks.consumeMutation).toHaveBeenCalledOnce();
    expect(mocks.consumeRefresh).toHaveBeenCalledOnce();
    expect(mocks.fetchEquityQuote).toHaveBeenCalledOnce();
    expect(callOrder(mocks.consumeMutation)).toBeLessThan(callOrder(mocks.consumeRefresh));
    expect(callOrder(mocks.consumeRefresh)).toBeLessThan(callOrder(mocks.fetchEquityQuote));
  });

  it.each([
    {
      name: "quote lookup",
      invoke: async () => {
        const { GET } = await import("@/app/api/stocks/quote/route");
        return GET(request("http://unit.test/api/stocks/quote?symbol=AAPL"), undefined);
      },
    },
    {
      name: "stock creation",
      invoke: async () => {
        const { POST } = await import("@/app/api/stocks/route");
        return POST(
          request("http://unit.test/api/stocks", {
            method: "POST",
            body: JSON.stringify(validStock),
            headers: { "content-type": "application/json" },
          }),
          undefined,
        );
      },
    },
  ])(
    "does not call the provider for a Demo $name when its credit is exhausted",
    async ({ invoke }) => {
      mocks.consumeRefresh.mockResolvedValue({
        ok: false,
        reason: "rate",
        retryAfterSeconds: 27,
      });

      const response = await invoke();

      expect(response.status).toBe(429);
      expect(mocks.consumeRefresh).toHaveBeenCalledOnce();
      expect(mocks.fetchEquityQuote).not.toHaveBeenCalled();
    },
  );

  it("keeps formal quote lookup behavior outside the Demo refresh quota", async () => {
    mocks.resolvePrincipal.mockResolvedValue({
      status: "active",
      principal: { kind: "formal", userId: "formal-user" },
    });
    const { GET } = await import("@/app/api/stocks/quote/route");

    const response = await GET(request("http://unit.test/api/stocks/quote?symbol=AAPL"), undefined);

    expect(response.status).toBe(200);
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
    expect(mocks.fetchEquityQuote).toHaveBeenCalledWith("AAPL", {
      redactIdentifiers: false,
    });
  });
});
