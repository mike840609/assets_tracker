import { describe, it, expect, vi } from "vitest";

// exchange-rate-service imports `server-only` (aliased in vitest.config),
// `@/lib/prisma` (loads env + a real DB client) and `@/lib/logger`
// (loads Sentry). resolveRate is pure, so we stub those import-time
// dependencies and exercise the function against an in-memory rate map.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  withTiming: <T>(_name: string, fn: () => T) => fn(),
}));

const { resolveRate } = await import("@/lib/services/exchange-rate-service");

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
