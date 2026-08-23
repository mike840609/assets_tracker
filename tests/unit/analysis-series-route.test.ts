import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolvePrincipal: vi.fn(),
  getOrCreateSettings: vi.fn(),
  getCachedAnalysisRangeSeries: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth-principal", () => ({ resolvePrincipal: mocks.resolvePrincipal }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ AUTH_SECRET: "unit-test-secret", isPublicDemoEnabled: true }));
vi.mock("@/lib/services/settings-service", () => ({
  getOrCreateSettings: mocks.getOrCreateSettings,
}));
vi.mock("@/lib/services/analysis-payload-service", () => ({
  getCachedAnalysisRangeSeries: mocks.getCachedAnalysisRangeSeries,
}));

function request(range?: string) {
  const url = new URL("http://unit.test/api/analysis/series");
  if (range) url.searchParams.set("range", range);
  return new Request(url);
}

describe("analysis series route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "jwt-user" } });
    mocks.resolvePrincipal.mockResolvedValue({
      status: "active",
      principal: { kind: "formal", userId: "principal-user" },
    });
    mocks.getOrCreateSettings.mockResolvedValue({ baseCurrency: "USD" });
    mocks.getCachedAnalysisRangeSeries.mockResolvedValue({
      buckets: [],
      kpis: {},
      cashFlowBuckets: [],
      cumulativeGrowth: [],
      categoryHistory: [],
      attributionItems: [],
      investmentReturnPct: null,
      returnTrend: [],
      rangeStartIso: "2026-01-01",
    });
  });

  it("rejects an invalid range before reading user data", async () => {
    const { GET } = await import("@/app/api/analysis/series/route");

    const response = await GET(request("BOGUS"), undefined);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { message: "Validation failed" },
    });
    expect(mocks.getCachedAnalysisRangeSeries).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/analysis/series/route");

    const response = await GET(request("All"), undefined);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Unauthorized" },
    });
  });

  it("returns the requested authenticated range series", async () => {
    const { GET } = await import("@/app/api/analysis/series/route");

    const response = await GET(request("All"), undefined);

    expect(response.status).toBe(200);
    expect(mocks.getCachedAnalysisRangeSeries).toHaveBeenCalledWith("principal-user", "USD", "All");
    await expect(response.json()).resolves.toMatchObject({
      data: { rangeStartIso: "2026-01-01" },
    });
  });
});
