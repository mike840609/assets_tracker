import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getCalendarEarnings: vi.fn(),
  rateLimitCheckWithPrune: vi.fn(),
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (
      handler: (
        request: Request,
        ctx: unknown,
        userId: string,
        principal: unknown,
      ) => Promise<Response>,
    ) =>
    (request: Request, ctx: unknown) =>
      handler(request, ctx, "user1", { kind: "formal", userId: "user1" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheckWithPrune: h.rateLimitCheckWithPrune,
  rateLimitKeyForSubject: () => "subject-key",
}));

vi.mock("@/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/services/calendar-earnings-data", () => ({
  CALENDAR_EARNINGS_RATE_LIMIT: { limit: 5, windowMs: 60_000, prefix: "calendar-earnings" },
  getCalendarEarnings: h.getCalendarEarnings,
}));

import { GET } from "@/app/api/calendar-earnings/route";

function request(query: string) {
  return new Request(`http://unit.test/api/calendar-earnings${query}`);
}

describe("calendar earnings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.rateLimitCheckWithPrune.mockReturnValue(null);
    h.getCalendarEarnings.mockResolvedValue([
      {
        date: "2026-08-21",
        symbol: "AAPL",
        name: "Apple",
        session: "AMC",
        isEstimate: false,
        epsForward: 1.5,
      },
    ]);
  });

  it("returns earnings for the requested range", async () => {
    const response = await GET(request("?from=2026-08-01&to=2026-08-31"), undefined);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { earnings: [expect.objectContaining({ symbol: "AAPL" })] },
    });
    expect(h.getCalendarEarnings).toHaveBeenCalledWith("user1", "2026-08-01", "2026-08-31");
  });

  it("rejects an unbounded or reversed range before the provider", async () => {
    const response = await GET(request("?from=2026-01-01&to=2026-12-31"), undefined);

    expect(response.status).toBe(400);
    expect(h.getCalendarEarnings).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user rate limit is exhausted", async () => {
    h.rateLimitCheckWithPrune.mockReturnValueOnce(new Response(null, { status: 429 }));

    const response = await GET(request("?from=2026-08-01&to=2026-08-31"), undefined);

    expect(response.status).toBe(429);
    expect(h.getCalendarEarnings).not.toHaveBeenCalled();
  });

  it("returns 500 when the provider fails", async () => {
    h.getCalendarEarnings.mockRejectedValueOnce(new Error("Yahoo down"));

    const response = await GET(request("?from=2026-08-01&to=2026-08-31"), undefined);

    expect(response.status).toBe(500);
  });
});
