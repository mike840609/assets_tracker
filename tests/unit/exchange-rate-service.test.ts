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

  it("skips Frankfurter entirely for a non-ECB base and uses er-api", async () => {
    // ASTT-A: Frankfurter (ECB) can't serve TWD — it returns a guaranteed
    // 404 — so the gate must skip it outright (no wasted round-trip, no
    // frankfurter.fallback warning) and go straight to the er-api source.
    const fetchSpy = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(JSON.stringify({ result: "success", rates: { TWD: 32, USD: 1 } }), {
          status: 200,
        }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const rates = await fetchExchangeRates("TWD");

    // Returns the fallback's rates, with the base currency stripped.
    expect(rates).toEqual({ USD: 1 });
    // Frankfurter was never contacted.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain("frankfurter");
    expect(logSpies.warn).not.toHaveBeenCalled();
    expect(logSpies.error).not.toHaveBeenCalled();
  });

  it("uses Frankfurter directly for a supported ECB base", async () => {
    const fetchSpy = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(JSON.stringify({ rates: { EUR: 0.9, TWD: 32 } }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const rates = await fetchExchangeRates("USD");

    expect(rates).toEqual({ EUR: 0.9, TWD: 32 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("frankfurter");
    expect(logSpies.error).not.toHaveBeenCalled();
  });

  it("falls back to er-api with a breadcrumb warning when Frankfurter fails for an ECB base", async () => {
    // A transient Frankfurter failure for a supported base must stay a
    // warn-level breadcrumb (never a captured log.error) since er-api covers it.
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("frankfurter")) return new Response(null, { status: 500 });
      return new Response(JSON.stringify({ result: "success", rates: { EUR: 0.9, USD: 1 } }), {
        status: 200,
      });
    }) as typeof fetch;

    const rates = await fetchExchangeRates("USD");

    expect(rates).toEqual({ EUR: 0.9 });
    expect(logSpies.warn).toHaveBeenCalledWith(
      "rates.frankfurter.fallback",
      expect.objectContaining({ base: "USD" }),
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
