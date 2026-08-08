import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolvePrincipal: vi.fn(),
  consumeMutation: vi.fn(),
  consumeRefresh: vi.fn(),
  deleteExpiredDemoUser: vi.fn(),
  recordDemoMetric: vi.fn(),
  after: vi.fn(),
  scheduled: undefined as (() => void | Promise<void>) | undefined,
  order: [] as string[],
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth-principal", () => ({ resolvePrincipal: mocks.resolvePrincipal }));
vi.mock("@/lib/auth-user", () => ({ userExists: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/prisma", () => ({ prisma: { quotaDb: true } }));
vi.mock("@/lib/demo/demo-quota-service", () => ({
  consumeDemoMutationQuota: mocks.consumeMutation,
  consumeDemoRefreshQuota: mocks.consumeRefresh,
}));
vi.mock("@/lib/env", () => ({ AUTH_SECRET: "unit-test-secret", isPublicDemoEnabled: true }));
vi.mock("@/lib/demo/demo-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/demo/demo-service")>()),
  deleteExpiredDemoUser: mocks.deleteExpiredDemoUser,
}));
vi.mock("@/lib/demo/demo-metrics", () => ({ recordDemoMetric: mocks.recordDemoMetric }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

import { withAuth } from "@/lib/api-handler";

const demoPrincipal = {
  kind: "demo" as const,
  userId: "demo-user",
  expiresAt: new Date("2026-08-01T01:00:00.000Z"),
};

function request(method = "GET") {
  return new Request("http://unit.test/api/resource", { method });
}

async function errorBody(response: Response) {
  return (await response.json()) as { error: { message: string; code?: string } };
}

describe("withAuth public Demo policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduled = undefined;
    mocks.order.length = 0;
    mocks.auth.mockResolvedValue({ user: { id: "jwt-user", isDemo: false } });
    mocks.resolvePrincipal.mockResolvedValue({ status: "active", principal: demoPrincipal });
    mocks.consumeMutation.mockImplementation(async () => {
      mocks.order.push("mutation");
      return { ok: true };
    });
    mocks.consumeRefresh.mockImplementation(async () => {
      mocks.order.push("refresh");
      return { ok: true };
    });
    mocks.deleteExpiredDemoUser.mockResolvedValue({ deleted: 1, failed: false });
    mocks.after.mockImplementation((callback: () => void | Promise<void>) => {
      mocks.scheduled = callback;
    });
  });

  it("denies Demo by default without invoking the handler or charging quota", async () => {
    const handler = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await withAuth(handler)(request("POST"), undefined);

    expect(response.status).toBe(403);
    await expect(errorBody(response)).resolves.toEqual({
      error: {
        code: "DEMO_RESTRICTED",
        message: "This feature requires a formal account",
      },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(mocks.consumeMutation).not.toHaveBeenCalled();
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
  });

  it("allows Demo reads without charging a mutation", async () => {
    const handler = vi.fn(async () => new Response("read"));
    const response = await withAuth(handler, { demo: "allow" })(request(), undefined);

    expect(await response.text()).toBe("read");
    expect(handler).toHaveBeenCalledWith(request(), undefined, "demo-user", demoPrincipal);
    expect(mocks.consumeMutation).not.toHaveBeenCalled();
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
  });

  it("gives a market-data route a refresh-credit capability without spending it before validation", async () => {
    mocks.consumeRefresh.mockResolvedValue({
      ok: false,
      reason: "rate",
      retryAfterSeconds: 23,
    });
    let refreshCredit: unknown;
    const handler = vi.fn(async (...args: unknown[]) => {
      refreshCredit = args[4];
      return new Response(null, { status: 204 });
    });

    const response = await withAuth(handler, {
      demo: "allow",
      marketData: "refresh-credit",
    })(request(), undefined);

    expect(response.status).toBe(204);
    expect(handler).toHaveBeenCalledOnce();
    expect(refreshCredit).toBeTypeOf("function");
    expect(mocks.consumeMutation).not.toHaveBeenCalled();
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
  });

  it("returns a quota response from the refresh-credit capability before provider work", async () => {
    mocks.consumeRefresh.mockResolvedValue({
      ok: false,
      reason: "rate",
      retryAfterSeconds: 23,
    });
    let providerCalled = false;
    const handler = vi.fn(async (...args: unknown[]) => {
      const refreshCredit = args[4] as undefined | (() => Promise<Response | null>);
      if (typeof refreshCredit !== "function")
        return new Response("missing capability", { status: 500 });
      const limited = await refreshCredit();
      if (limited) return limited;
      providerCalled = true;
      return new Response(null, { status: 204 });
    });

    const response = await withAuth(handler, {
      demo: "allow",
      marketData: "refresh-credit",
    })(request(), undefined);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("23");
    await expect(errorBody(response)).resolves.toEqual({
      error: { code: "DEMO_RATE_LIMITED", message: "Public Demo rate limit reached" },
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(providerCalled).toBe(false);
    expect(mocks.consumeRefresh).toHaveBeenCalledWith(
      { quotaDb: true },
      "demo-user",
      expect.any(Date),
    );
  });

  it("consumes one database mutation charge before invoking an allowed Demo mutation", async () => {
    const handler = vi.fn(async () => {
      mocks.order.push("handler");
      return new Response(null, { status: 204 });
    });

    const response = await withAuth(handler, { demo: "allow" })(request("POST"), undefined);

    expect(response.status).toBe(204);
    expect(mocks.order).toEqual(["mutation", "handler"]);
    expect(mocks.consumeMutation).toHaveBeenCalledWith(
      { quotaDb: true },
      "demo-user",
      expect.any(Date),
      { reset: false },
    );
  });

  it("consumes mutation then refresh quota before invoking a Demo market refresh", async () => {
    const handler = vi.fn(async () => {
      mocks.order.push("handler");
      return new Response(null, { status: 204 });
    });

    const response = await withAuth(handler, { demo: "market-refresh" })(
      request("POST"),
      undefined,
    );

    expect(response.status).toBe(204);
    expect(mocks.order).toEqual(["mutation", "refresh", "handler"]);
    expect(mocks.consumeRefresh).toHaveBeenCalledWith(
      { quotaDb: true },
      "demo-user",
      expect.any(Date),
    );
  });

  it("keeps the mutation charge ahead of a Demo route's deferred live-market credit", async () => {
    let refreshCredit: unknown;
    const handler = vi.fn(async (...args: unknown[]) => {
      refreshCredit = args[4];
      mocks.order.push("handler");
      return new Response(null, { status: 204 });
    });

    const response = await withAuth(handler, {
      demo: "allow",
      marketData: "refresh-credit",
    })(request("POST"), undefined);

    expect(response.status).toBe(204);
    expect(mocks.order).toEqual(["mutation", "handler"]);
    expect(refreshCredit).toBeTypeOf("function");
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
  });

  it("returns the shared coded quota response with Retry-After and skips the handler", async () => {
    mocks.consumeMutation.mockResolvedValue({
      ok: false,
      reason: "rate",
      retryAfterSeconds: 17,
    });
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth(handler, { demo: "allow" })(request("PATCH"), undefined);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(errorBody(response)).resolves.toEqual({
      error: { code: "DEMO_RATE_LIMITED", message: "Public Demo rate limit reached" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves a handler ownership 404 after policy authorization", async () => {
    const handler = vi.fn(async (_req, _ctx, userId: string) => {
      expect(userId).toBe("demo-user");
      return new Response(null, { status: 404 });
    });

    const response = await withAuth(handler, { demo: "allow" })(request("DELETE"), undefined);

    expect(response.status).toBe(404);
    expect(mocks.consumeMutation).toHaveBeenCalledOnce();
  });

  it("returns 410 for expired Demo and schedules cleanup outside the request path", async () => {
    mocks.resolvePrincipal.mockResolvedValue({ status: "demo-expired", userId: "expired-demo" });
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth(handler, { demo: "allow" })(request(), undefined);

    expect(response.status).toBe(410);
    await expect(errorBody(response)).resolves.toEqual({
      error: { code: "DEMO_EXPIRED", message: "Public Demo expired" },
    });
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.deleteExpiredDemoUser).not.toHaveBeenCalled();
    await mocks.scheduled?.();
    expect(mocks.deleteExpiredDemoUser).toHaveBeenCalledWith("expired-demo", expect.any(Date));
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 503 for disabled Demo without scheduling cleanup", async () => {
    mocks.resolvePrincipal.mockResolvedValue({ status: "demo-disabled", userId: "disabled-demo" });
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth(handler, { demo: "allow" })(request(), undefined);

    expect(response.status).toBe(503);
    await expect(errorBody(response)).resolves.toEqual({
      error: { code: "DEMO_DISABLED", message: "Public Demo is disabled" },
    });
    expect(mocks.after).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("retains the formal 60-per-minute mutation limiter without Demo quota calls", async () => {
    mocks.resolvePrincipal.mockResolvedValue({
      status: "active",
      principal: { kind: "formal", userId: "formal-user" },
    });
    const handler = vi.fn(async () => new Response(null, { status: 204 }));
    const endpoint = withAuth(handler);

    for (let count = 0; count < 60; count += 1) {
      expect((await endpoint(request("POST"), undefined)).status).toBe(204);
    }
    const limited = await endpoint(request("POST"), undefined);

    expect(limited.status).toBe(429);
    expect(handler).toHaveBeenCalledTimes(60);
    expect(mocks.consumeMutation).not.toHaveBeenCalled();
    expect(mocks.consumeRefresh).not.toHaveBeenCalled();
  });
});
