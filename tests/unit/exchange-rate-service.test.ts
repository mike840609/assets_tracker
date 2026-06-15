import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// exchange-rate-service imports `server-only` (aliased in vitest.config),
// `@/lib/prisma` (loads env + a real DB client) and `@/lib/logger`
// (loads Sentry). resolveRate is pure, so we stub those import-time
// dependencies and exercise the function against an in-memory rate map.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const logSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@/lib/logger", () => ({
  log: logSpies,
  withTiming: <T>(_name: string, fn: () => T) => fn(),
}));

const { resolveRate, fetchExchangeRates } = await import("@/lib/services/exchange-rate-service");

describe("resolveRate", () => {
  it("returns 1 for an identity conversion", () => {
    expect(resolveRate(new Map(), "USD", "USD")).toBe(1);
  });

  it("uses a direct rate when present", () => {
    const map = new Map([["USD_TWD", 30]]);
    expect(resolveRate(map, "USD", "TWD")).toBe(30);
  });

  it("inverts when only the reverse pair exists", () => {
    const map = new Map([["USD_TWD", 30]]);
    expect(resolveRate(map, "TWD", "USD")).toBeCloseTo(1 / 30);
  });

  it("derives a cross rate via USD", () => {
    // TWD→EUR = (USD→EUR) / (USD→TWD) = 0.9 / 30
    const map = new Map([
      ["USD_TWD", 30],
      ["USD_EUR", 0.9],
    ]);
    expect(resolveRate(map, "TWD", "EUR")).toBeCloseTo(0.9 / 30);
  });

  it("derives a cross rate using inverse USD legs", () => {
    // Only TWD_USD and EUR_USD known → both legs inverted internally.
    const map = new Map([
      ["TWD_USD", 1 / 30],
      ["EUR_USD", 1 / 0.9],
    ]);
    expect(resolveRate(map, "TWD", "EUR")).toBeCloseTo(0.9 / 30);
  });

  it("returns undefined when no path resolves the pair", () => {
    const map = new Map([["USD_TWD", 30]]);
    expect(resolveRate(map, "JPY", "GBP")).toBeUndefined();
  });
});

describe("fetchExchangeRates", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    logSpies.info.mockClear();
    logSpies.warn.mockClear();
    logSpies.error.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("falls back to er-api without a captured error when Frankfurter 404s for a non-ECB base", async () => {
    // Frankfurter (ECB) doesn't cover TWD → 404; the secondary source does.
    // Regression guard for the Sentry-noise fix (ASTT-A): the recovered
    // primary miss must be a warn-level breadcrumb, never a log.error
    // (which forwards to Sentry.captureException).
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("frankfurter")) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify({ result: "success", rates: { TWD: 32, USD: 1 } }), {
        status: 200,
      });
    }) as typeof fetch;

    const rates = await fetchExchangeRates("TWD");

    // Returns the fallback's rates, with the base currency stripped.
    expect(rates).toEqual({ USD: 1 });
    // The primary miss is a breadcrumb-level warning, not an escalated error.
    expect(logSpies.warn).toHaveBeenCalledWith(
      "rates.frankfurter.fallback",
      expect.objectContaining({ base: "TWD" }),
    );
    expect(logSpies.error).not.toHaveBeenCalled();
  });

  it("returns {} and logs an error only when both sources fail", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;

    const rates = await fetchExchangeRates("USD");

    expect(rates).toEqual({});
    expect(logSpies.error).toHaveBeenCalledWith(
      "rates.fetch.failed",
      expect.objectContaining({ base: "USD" }),
    );
  });
});
