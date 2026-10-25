import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  quote: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheTag: h.cacheTag,
  cacheLife: h.cacheLife,
}));

vi.mock("@/lib/services/yahoo-client", () => ({
  getYahooClient: () => Promise.resolve({ quote: h.quote }),
}));

vi.mock("@/lib/services/calendar-earnings-service", () => ({
  getCalendarEarningsWatch: async () => [
    { id: "1", symbol: "AAPL", name: "Apple", source: "tracked" },
    { id: "2", symbol: "MSFT", name: "Microsoft", source: "manual" },
  ],
}));

import { getCalendarEarnings } from "@/lib/services/calendar-earnings-data";

describe("getCalendarEarnings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns earnings mapped to Taiwan days within range", async () => {
    h.quote.mockResolvedValue([
      { symbol: "AAPL", earningsCallTimestampStart: new Date("2026-08-20T20:00:00.000Z") }, // AMC -> 08-21
      { symbol: "MSFT", earningsTimestamp: new Date("2026-08-20T00:00:00.000Z") }, // UNKNOWN -> 08-20
    ]);
    const result = await getCalendarEarnings("u", "2026-08-01", "2026-08-31");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: "AAPL", date: "2026-08-21", session: "AMC" }),
        expect.objectContaining({ symbol: "MSFT", date: "2026-08-20", session: "UNKNOWN" }),
      ]),
    );
  });

  it("drops earnings outside the range", async () => {
    h.quote.mockResolvedValue([
      { symbol: "AAPL", earningsTimestamp: new Date("2026-09-15T00:00:00.000Z") },
    ]);
    const result = await getCalendarEarnings("u", "2026-08-01", "2026-08-31");
    expect(result).toEqual([]);
  });

  it("returns empty when no quotes", async () => {
    h.quote.mockResolvedValue([]);
    const result = await getCalendarEarnings("u", "2026-08-01", "2026-08-31");
    expect(result).toEqual([]);
  });

  it("skips quotes without an earnings date", async () => {
    h.quote.mockResolvedValue([{ symbol: "AAPL" }]);

    const result = await getCalendarEarnings("u", "2026-08-01", "2026-08-31");

    expect(result).toEqual([]);
  });

  it("propagates Yahoo failures so the caller can show an unavailable state", async () => {
    h.quote.mockRejectedValue(new Error("Yahoo unavailable"));

    await expect(getCalendarEarnings("u", "2026-08-01", "2026-08-31")).rejects.toThrow(
      "Yahoo unavailable",
    );
  });
});
