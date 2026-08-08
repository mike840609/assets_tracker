import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const rateLimitCounts = new Map<string, number>();
  return {
    exportQueries: 0,
    cspWarnings: 0,
    principal: { kind: "formal" as const, userId: "user1" } as
      | { kind: "formal"; userId: string }
      | { kind: "demo"; userId: string; expiresAt: Date },
    logError: vi.fn(),
    logWarn: vi.fn(),
    yahooSearch: vi.fn(),
    yahooOptions: vi.fn(),
    fetchEquityQuote: vi.fn(),
    warmStockPrice: vi.fn(),
    tryWarmStockPrice: vi.fn(),
    cacheEquityQuote: vi.fn(),
    tryCacheEquityQuote: vi.fn(),
    refreshTrackedStockPrices: vi.fn(),
    invalidateStockWatchCaches: vi.fn(),
    rateLimitCounts,
    rateLimitCheckWithPrune: vi.fn(
      (
        request: Request,
        options: { limit: number; prefix?: string; key?: string },
      ): Response | null => {
        const key = `${options.prefix ?? "rl"}:${options.key ?? request.headers.get("x-forwarded-for") ?? "unknown"}`;
        const count = (rateLimitCounts.get(key) ?? 0) + 1;
        rateLimitCounts.set(key, count);
        return count > options.limit ? new Response(null, { status: 429 }) : null;
      },
    ),
    rateLimitKeyForClientIp: vi.fn(() => "hmac:formal-quote-ip"),
    rateLimitKeyForSubject: vi.fn(() => "hmac:demo-quote-subject"),
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  // The data route imports price-service (import price warm), which builds an
  // unstable_cache wrapper at module scope.
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (
      handler: (
        req: Request,
        ctx: unknown,
        userId: string,
        principal: typeof h.principal,
        consumeRefreshCredit?: () => Promise<Response | null>,
      ) => Promise<Response>,
      options: {
        demo?: "allow" | "deny" | "market-refresh";
        marketData?: "refresh-credit";
      } = {},
    ) =>
    (req: Request, ctx: unknown) => {
      if (h.principal.kind === "demo" && (options.demo ?? "deny") === "deny") {
        return Response.json(
          {
            error: {
              code: "DEMO_RESTRICTED",
              message: "This feature requires a formal account",
            },
          },
          { status: 403 },
        );
      }
      return handler(
        req,
        ctx,
        "user1",
        h.principal,
        options.marketData === "refresh-credit" ? async () => null : undefined,
      );
    },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheckWithPrune: h.rateLimitCheckWithPrune,
  rateLimitKeyForClientIp: h.rateLimitKeyForClientIp,
  rateLimitKeyForSubject: h.rateLimitKeyForSubject,
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    error: h.logError,
    info: vi.fn(),
    warn: h.logWarn.mockImplementation(() => {
      h.cspWarnings += 1;
    }),
  },
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(),
  resolveRate: vi.fn(),
}));

vi.mock("@/lib/services/yahoo-client", () => ({
  getYahooClient: vi.fn(async () => ({ search: h.yahooSearch, options: h.yahooOptions })),
  getYahooErrorStatus: vi.fn((error: unknown) =>
    typeof error === "object" && error && "code" in error ? Number(error.code) : undefined,
  ),
}));

vi.mock("@/lib/services/stock-watch-service", () => ({
  fetchEquityQuote: h.fetchEquityQuote,
  warmStockPrice: h.warmStockPrice,
  tryWarmStockPrice: h.tryWarmStockPrice,
  cacheEquityQuote: h.cacheEquityQuote,
  tryCacheEquityQuote: h.tryCacheEquityQuote,
  refreshTrackedStockPrices: h.refreshTrackedStockPrices,
  invalidateStockWatchCaches: h.invalidateStockWatchCaches,
  getCachedTrackedStocks: vi.fn(async () => []),
  serializeStockWatchItem: (item: Record<string, unknown>) => item,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => {
        h.exportQueries += 1;
        return {
          appAccounts: [],
          appSettings: null,
          goals: [],
          snapshots: [],
          stockWatchItems: [],
          calendarEntries: [],
        };
      }),
    },
    stockWatchItem: {
      findUnique: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _max: { sortOrder: null } })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "stock1",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        ...args.data,
      })),
    },
  },
}));

const request = (url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("x-forwarded-for", "198.51.100.10");
  return new Request(url, { ...init, headers });
};

describe("rate-limited routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    h.exportQueries = 0;
    h.cspWarnings = 0;
    h.principal = { kind: "formal", userId: "user1" };
    h.fetchEquityQuote.mockResolvedValue({
      symbol: "AAPL",
      name: "Apple",
      exchange: "NASDAQ",
      currency: "USD",
      price: 200,
    });
    h.warmStockPrice.mockResolvedValue({
      price: 200,
      currency: "USD",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    h.tryWarmStockPrice.mockResolvedValue(null);
    h.cacheEquityQuote.mockResolvedValue({
      price: 200,
      currency: "USD",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    h.tryCacheEquityQuote.mockResolvedValue(null);
    h.refreshTrackedStockPrices.mockResolvedValue({ updated: 1, changed: 1 });
    h.rateLimitCounts.clear();
    h.rateLimitCheckWithPrune.mockClear();
    h.rateLimitKeyForClientIp.mockClear();
    h.rateLimitKeyForSubject.mockClear();
  });

  it("limits data export by authenticated user before export queries", async () => {
    const { GET } = await import("@/app/api/settings/data/route");

    for (let i = 0; i < 5; i += 1) {
      expect((await GET(request("http://unit.test/api/settings/data"), undefined)).status).toBe(
        200,
      );
    }

    expect((await GET(request("http://unit.test/api/settings/data"), undefined)).status).toBe(429);
    expect(h.exportQueries).toBe(5);
  });

  it("denies Demo export and import before query or body parsing", async () => {
    h.principal = {
      kind: "demo",
      userId: "user1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { GET, POST } = await import("@/app/api/settings/data/route");
    const importRequest = request("http://unit.test/api/settings/data", { method: "POST" });
    const json = vi.spyOn(importRequest, "json").mockRejectedValue(new Error("must not parse"));

    const exported = await GET(request("http://unit.test/api/settings/data"), undefined);
    const imported = await POST(importRequest, undefined);

    expect(exported.status).toBe(403);
    expect(imported.status).toBe(403);
    expect(h.exportQueries).toBe(0);
    expect(json).not.toHaveBeenCalled();
    await expect(exported.json()).resolves.toMatchObject({
      error: { code: "DEMO_RESTRICTED" },
    });
  });

  it("reuses the fetched Demo quote for cache warming instead of requesting the provider twice", async () => {
    h.principal = {
      kind: "demo",
      userId: "user1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { POST } = await import("@/app/api/stocks/route");
    const { GET } = await import("@/app/api/stocks/quote/route");

    const created = await POST(
      request("http://unit.test/api/stocks", {
        method: "POST",
        body: JSON.stringify({
          symbol: "AAPL",
          name: "Apple",
          exchange: "NASDAQ",
          currency: "USD",
          recordPrice: 190,
          recordDate: "2026-08-01",
        }),
        headers: { "content-type": "application/json" },
      }),
      undefined,
    );
    const quoted = await GET(request("http://unit.test/api/stocks/quote?symbol=AAPL"), undefined);

    expect(created.status).toBe(201);
    expect(quoted.status).toBe(200);
    expect(h.fetchEquityQuote).toHaveBeenCalledWith("AAPL", { redactIdentifiers: true });
    expect(h.tryCacheEquityQuote).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAPL", price: 200 }),
      { redactIdentifiers: true },
    );
    expect(h.cacheEquityQuote).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAPL", price: 200 }),
    );
    expect(h.tryWarmStockPrice).not.toHaveBeenCalled();
    expect(h.warmStockPrice).not.toHaveBeenCalled();
  });

  it("keys the Demo quote limiter with an opaque, purpose-separated principal token", async () => {
    h.principal = {
      kind: "demo",
      userId: "user1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { GET } = await import("@/app/api/stocks/quote/route");

    const response = await GET(
      request("http://unit.test/api/stocks/quote?symbol=AAPL", {
        headers: { "x-forwarded-for": "DEMO_QUOTE_IP_SENTINEL" },
      }),
      undefined,
    );

    expect(response.status).toBe(200);
    expect(h.rateLimitKeyForSubject).toHaveBeenCalledWith("user1", "public-demo-stocks-quote");
    expect(h.rateLimitCheckWithPrune).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        prefix: "stocks-quote",
        key: "hmac:demo-quote-subject",
      }),
    );
    expect(JSON.stringify(h.rateLimitCheckWithPrune.mock.calls)).not.toContain(
      "DEMO_QUOTE_IP_SENTINEL",
    );
  });

  it("passes redacted logging options through Demo tracked-stock refresh", async () => {
    h.principal = {
      kind: "demo",
      userId: "user1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { POST } = await import("@/app/api/stocks/refresh/route");

    const response = await POST(
      request("http://unit.test/api/stocks/refresh", { method: "POST" }),
      undefined,
    );

    expect(response.status).toBe(200);
    expect(h.refreshTrackedStockPrices).toHaveBeenCalledWith("user1", {
      redactIdentifiers: true,
    });
  });

  it("redacts public search and option provider failures for every caller", async () => {
    h.yahooSearch.mockRejectedValueOnce(new Error("raw search SENTINEL_QUERY"));
    h.yahooOptions.mockRejectedValueOnce(new Error("raw option SENTINEL_SYMBOL"));
    const { GET: search } = await import("@/app/api/search/route");
    const { GET: options } = await import("@/app/api/options/chain/route");

    const searchResponse = await search(request("http://unit.test/api/search?q=SENTINEL_QUERY"));
    const optionsResponse = await options(
      request("http://unit.test/api/options/chain?symbol=SENTINEL"),
    );

    expect(searchResponse.status).toBe(502);
    expect(optionsResponse.status).toBe(200);
    const logged = JSON.stringify([...h.logError.mock.calls, ...h.logWarn.mock.calls]);
    expect(logged).not.toContain("SENTINEL_QUERY");
    expect(logged).not.toContain("SENTINEL_SYMBOL");
    expect(logged).not.toContain("raw search");
    expect(logged).not.toContain("raw option");
  });

  it("limits CSP reports by client IP before logging more reports", async () => {
    const { POST } = await import("@/app/api/csp/report/route");

    for (let i = 0; i < 30; i += 1) {
      expect(
        (
          await POST(
            request("http://unit.test/api/csp/report", {
              method: "POST",
              body: JSON.stringify({ "csp-report": { "blocked-uri": "inline" } }),
            }),
          )
        ).status,
      ).toBe(204);
    }

    expect(
      (
        await POST(
          request("http://unit.test/api/csp/report", {
            method: "POST",
            body: JSON.stringify({ "csp-report": { "blocked-uri": "inline" } }),
          }),
        )
      ).status,
    ).toBe(429);
    expect(h.cspWarnings).toBe(30);
  });
});
