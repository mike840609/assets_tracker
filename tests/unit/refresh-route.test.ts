import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  priceResult: {
    outcome: "total_failure",
    updated: 0,
    changed: 0,
    skippedFresh: 0,
    errors: ["Yahoo Finance batch failed"],
    nextRefreshAt: null,
    retryAfterSeconds: null,
  },
  principal: { kind: "formal" as const, userId: "user-1" } as
    | { kind: "formal"; userId: string }
    | { kind: "demo"; userId: string; expiresAt: Date },
}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (
      handler: (
        request: Request,
        context: unknown,
        userId: string,
        principal: typeof h.principal,
      ) => Promise<Response>,
    ) =>
    (request: Request, context: unknown) =>
      handler(request, context, "user-1", h.principal),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheckWithPrune: vi.fn(() => null),
  rateLimitKeyForSubject: vi.fn(() => "hmac:market-refresh"),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn(async () => ({ baseCurrency: "USD" })) },
    account: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/services/price-service", () => ({
  refreshPricesForUser: vi.fn(async () => h.priceResult),
}));
vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(async () => ({
    updated: 0,
    changed: 0,
    skippedFresh: false,
    fetchFailed: false,
    nextRefreshAt: null,
  })),
}));

describe("unified market refresh route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.priceResult = {
      outcome: "total_failure",
      updated: 0,
      changed: 0,
      skippedFresh: 0,
      errors: ["Yahoo Finance batch failed"],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
    h.principal = { kind: "formal", userId: "user-1" };
  });

  it("returns the total price-refresh failure outcome to clients", async () => {
    const { POST } = await import("@/app/api/refresh/route");
    const response = await POST(
      new Request("http://unit.test/api/refresh", { method: "POST" }),
      undefined,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { prices: { outcome: "total_failure", fetchFailed: true } },
    });
  });

  it("requests identifier-redacted price work for Demo refresh", async () => {
    h.principal = {
      kind: "demo",
      userId: "user-1",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const { refreshPricesForUser } = await import("@/lib/services/price-service");
    const { refreshExchangeRates } = await import("@/lib/services/exchange-rate-service");
    const { POST } = await import("@/app/api/refresh/route");

    const response = await POST(
      new Request("http://unit.test/api/refresh", { method: "POST" }),
      undefined,
    );

    expect(response.status).toBe(200);
    expect(refreshPricesForUser).toHaveBeenCalledWith("user-1", {
      redactIdentifiers: true,
    });
    expect(refreshExchangeRates).toHaveBeenCalledWith("USD", {
      redactIdentifiers: true,
    });
  });

  it("preserves the formal refresh call without redaction", async () => {
    const { refreshPricesForUser } = await import("@/lib/services/price-service");
    const { refreshExchangeRates } = await import("@/lib/services/exchange-rate-service");
    const { POST } = await import("@/app/api/refresh/route");

    await POST(new Request("http://unit.test/api/refresh", { method: "POST" }), undefined);

    expect(refreshPricesForUser).toHaveBeenCalledWith("user-1", {
      redactIdentifiers: false,
    });
    expect(refreshExchangeRates).toHaveBeenCalledWith("USD", {
      redactIdentifiers: false,
    });
  });
});
