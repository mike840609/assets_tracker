import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exportQueries: 0,
  cspWarnings: 0,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown, userId: string) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1"),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(() => {
      h.cspWarnings += 1;
    }),
  },
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(),
  resolveRate: vi.fn(),
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
        };
      }),
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
    h.exportQueries = 0;
    h.cspWarnings = 0;
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
