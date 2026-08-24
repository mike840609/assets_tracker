import { NextRequest, type NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolvePrincipalMock: vi.fn(),
  headersMock: vi.fn(),
  publicDemoEnabled: true,
}));
const { authMock, resolvePrincipalMock, headersMock } = mocks;

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: unknown) => handler,
  }),
}));

vi.mock("../../src/auth.config", () => ({ default: {} }));
vi.mock("@/auth", () => ({ auth: mocks.authMock }));
vi.mock("@/lib/auth-principal", () => ({ resolvePrincipal: mocks.resolvePrincipalMock }));
vi.mock("next/headers", () => ({ headers: mocks.headersMock }));
vi.mock("@/lib/env", () => ({
  AUTH_SECRET: "proxy-unit-secret",
  get isPublicDemoEnabled() {
    return mocks.publicDemoEnabled;
  },
}));

import proxy, { config } from "@/proxy";
import { getAuthContext, getSession } from "@/lib/auth-session";

const TUNNEL_PATH = "/a1b2c3d4";

function executeAnonymousRequest(pathname: string): Response {
  const request = new NextRequest(`https://astt.app${pathname}`);
  const response = proxy(request, {} as NextFetchEvent);

  if (!(response instanceof Response)) {
    throw new Error("Proxy did not return a response for an anonymous request");
  }

  return response;
}

function executeAuthenticatedRequest(
  pathname: string,
  isDemo: boolean,
  userAgent?: string,
): Response {
  const request = new NextRequest(`https://astt.app${pathname}`, {
    headers: {
      cookie: "authjs.session-token=signed-session",
      ...(userAgent ? { "user-agent": userAgent } : {}),
    },
  });
  Object.defineProperty(request, "auth", {
    value: {
      user: {
        id: isDemo ? "demo-user" : "formal-user",
        isDemo,
        demoExpiresAt: isDemo ? "2099-08-02T00:00:00.000Z" : null,
      },
    },
  });
  const response = proxy(request, {} as NextFetchEvent);

  if (!(response instanceof Response)) {
    throw new Error("Proxy did not return a response for an authenticated request");
  }

  return response;
}

afterEach(() => {
  mocks.publicDemoEnabled = true;
  vi.unstubAllEnvs();
});

describe("Sentry tunnel proxy bypass", () => {
  it("continues an anonymous request for the exact configured tunnel path", () => {
    vi.stubEnv("_sentryRewritesTunnelPath", TUNNEL_PATH);

    const response = executeAnonymousRequest(TUNNEL_PATH);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a different anonymous protected pathname to login", () => {
    vi.stubEnv("_sentryRewritesTunnelPath", TUNNEL_PATH);

    const response = executeAnonymousRequest(`${TUNNEL_PATH}/extra`);

    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(response.headers.get("location")).toBe("https://astt.app/login");
  });
});

describe("public landing page", () => {
  it("rewrites an anonymous root request to the landing page instead of redirecting", () => {
    const response = executeAnonymousRequest("/");

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://astt.app/landing");
  });

  it("serves the landing page directly to anonymous visitors", () => {
    const response = executeAnonymousRequest("/landing");

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("still redirects other anonymous protected routes to login", () => {
    const response = executeAnonymousRequest("/accounts");

    expect(response.headers.get("location")).toBe("https://astt.app/login");
  });

  it("keeps the authenticated dashboard on the root path", () => {
    const response = executeAuthenticatedRequest("/", false);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("mobile desktop-only route redirects", () => {
  const iphoneUserAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile";

  it.each([
    ["/stocks", "https://astt.app/goals"],
    ["/projections", "https://astt.app/goals?tab=projections"],
    [
      "/calendar?month=2026-08&date=2026-08-12",
      "https://astt.app/goals?month=2026-08&date=2026-08-12&tab=calendar",
    ],
  ])("redirects authenticated mobile %s into the Plan hub", (pathname, expectedLocation) => {
    const response = executeAuthenticatedRequest(pathname, false, iphoneUserAgent);

    expect(response.headers.get("location")).toBe(expectedLocation);
  });

  it("keeps authenticated desktop requests on standalone routes", () => {
    const response = executeAuthenticatedRequest(
      "/stocks",
      false,
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});

// Regression cover for #639: the matcher's bot-probe exclusions carried a
// leading `.*`, and JS `.` matches `/`, so any path containing `.env`/`.php`/…
// skipped the middleware — including real dynamic routes like /accounts/x.env.
describe("middleware matcher covers dynamic routes (#639)", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["clx123", "x.env", "x.php", "x.git", "x.htaccess"])(
    "matches /accounts/%s so the middleware always runs",
    (accountId) => {
      expect(matcher.test(`/accounts/${accountId}`)).toBe(true);
    },
  );

  it("uses no segment-spanning exclusion token", () => {
    expect(config.matcher[0]).not.toContain(".*\\.");
  });

  it.each([
    "/sw.js",
    "/manifest.webmanifest",
    "/hero.jpg",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/privacy",
    "/terms",
    "/_next/static/chunk.js",
    "/api/accounts",
  ])("still excludes the non-routable or public path %s", (pathname) => {
    expect(matcher.test(pathname)).toBe(false);
  });

  it("keeps an active signed Demo on protected routes", () => {
    const request = new NextRequest("https://astt.app/accounts", {
      headers: { cookie: "authjs.session-token=signed-session" },
    });
    Object.defineProperty(request, "auth", {
      value: {
        user: { id: "demo-user", isDemo: true, demoExpiresAt: "2099-01-01T00:00:00.000Z" },
      },
    });

    const response = proxy(request, {} as NextFetchEvent) as Response;
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("routes a signed Demo to expiry while the kill switch is off", () => {
    mocks.publicDemoEnabled = false;
    const request = new NextRequest("https://astt.app/accounts", {
      headers: { cookie: "authjs.session-token=signed-session" },
    });
    Object.defineProperty(request, "auth", {
      value: {
        user: { id: "demo-user", isDemo: true, demoExpiresAt: "2099-01-01T00:00:00.000Z" },
      },
    });

    const response = proxy(request, {} as NextFetchEvent) as Response;
    expect(response.headers.get("location")).toBe("https://astt.app/demo/expired");
  });

  it.each(["/login", "/demo/expired"])("matches Demo entry path %s", (pathname) => {
    expect(matcher.test(pathname)).toBe(true);
  });
});

describe("public Demo proxy lifecycle", () => {
  it("pre-seeds a valid visitor token for anonymous Demo entry pages without replacing it", () => {
    const first = executeAnonymousRequest("/login") as NextResponse;
    const token = first.cookies.get("asset-tracker-demo-visitor")?.value;
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const reused = new NextRequest("https://astt.app/login", {
      headers: { cookie: `asset-tracker-demo-visitor=${token}` },
    });
    const second = proxy(reused, {} as NextFetchEvent) as NextResponse;
    expect(second.cookies.get("asset-tracker-demo-visitor")).toBeUndefined();
  });

  it.each([
    ["2020-01-01T00:00:00.000Z", "/accounts"],
    [null, "/accounts"],
    ["not-a-date", "/accounts"],
  ])("routes unavailable signed Demo to expiry (%s)", (demoExpiresAt, pathname) => {
    const request = new NextRequest(`https://astt.app${pathname}`, {
      headers: { cookie: "authjs.session-token=signed-session" },
    });
    Object.defineProperty(request, "auth", {
      value: { user: { id: "demo-user", isDemo: true, demoExpiresAt } },
    });

    const response = proxy(request, {} as NextFetchEvent) as Response;
    expect(response.headers.get("location")).toBe("https://astt.app/demo/expired");
  });

  it("allows unavailable Demo sessions to reach formal login and stale-session recovery", () => {
    for (const pathname of ["/login?from=demo", "/login?stale-session=1"]) {
      const request = new NextRequest(`https://astt.app${pathname}`, {
        headers: { cookie: "authjs.session-token=signed-session" },
      });
      Object.defineProperty(request, "auth", {
        value: {
          user: { id: "demo-user", isDemo: true, demoExpiresAt: "2020-01-01T00:00:00.000Z" },
        },
      });
      const response = proxy(request, {} as NextFetchEvent) as Response;
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("allows an otherwise active Demo JWT through stale-session recovery", () => {
    const request = new NextRequest("https://astt.app/login?stale-session=1", {
      headers: { cookie: "authjs.session-token=signed-session" },
    });
    Object.defineProperty(request, "auth", {
      value: {
        user: { id: "deleted-demo", isDemo: true, demoExpiresAt: "2099-01-01T00:00:00.000Z" },
      },
    });

    const response = proxy(request, {} as NextFetchEvent) as Response;
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not apply Demo expiry fields to formal sessions", () => {
    const request = new NextRequest("https://astt.app/accounts", {
      headers: { cookie: "authjs.session-token=signed-session" },
    });
    Object.defineProperty(request, "auth", {
      value: {
        user: { id: "formal-user", isDemo: false, demoExpiresAt: "2020-01-01T00:00:00.000Z" },
      },
    });
    const response = proxy(request, {} as NextFetchEvent) as Response;
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("bot probe filtering inside the middleware", () => {
  it.each(["/wp-admin", "/xmlrpc.php", "/x.php", "/.env", "/vendor/phpunit/run"])(
    "passes the probe %s through to routing instead of redirecting to login",
    (pathname) => {
      const response = executeAnonymousRequest(pathname);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("does not mistake a dotted dynamic account id for a bot probe", () => {
    const response = executeAnonymousRequest("/accounts/x.env");

    expect(response.headers.get("location")).toBe("https://astt.app/login");
  });
});

describe("Demo formal-login handoff", () => {
  it("allows only an active Demo through /login?from=demo", () => {
    const response = executeAuthenticatedRequest("/login?from=demo", true);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("still redirects a formal principal that supplies from=demo", () => {
    const response = executeAuthenticatedRequest("/login?from=demo", false);

    expect(response.headers.get("location")).toBe("https://astt.app/");
  });

  it.each(["/login?from=x", "/login?from=demo&from=demo"])(
    "rejects the non-scalar Demo handoff %s",
    (pathname) => {
      const response = executeAuthenticatedRequest(pathname, true);

      expect(response.headers.get("location")).toBe("https://astt.app/");
    },
  );
});

describe("getSession identity source (#639)", () => {
  const VICTIM_ID = "clvictim000000000000000";

  beforeEach(() => {
    authMock.mockReset();
    resolvePrincipalMock.mockReset();
    headersMock.mockReset();
    headersMock.mockResolvedValue(
      new Headers({
        "x-asset-auth-source": "proxy",
        "x-asset-user-id": VICTIM_ID,
      }),
    );
  });

  it("returns no session for forged proxy identity headers without a session cookie", async () => {
    authMock.mockResolvedValue(null);

    await expect(getSession()).resolves.toBeNull();

    expect(resolvePrincipalMock).not.toHaveBeenCalledWith(VICTIM_ID);
  });

  it("never reads request headers to establish identity", async () => {
    authMock.mockResolvedValue(null);

    await getSession();

    expect(headersMock).not.toHaveBeenCalled();
  });

  it("still resolves the cookie-backed session from auth()", async () => {
    const session = { user: { id: "clowner0000000000000000", email: "owner@example.com" } };
    authMock.mockResolvedValue(session);
    resolvePrincipalMock.mockResolvedValue({
      status: "active",
      principal: { kind: "formal", userId: session.user.id },
    });

    await expect(getSession()).resolves.toEqual({
      user: {
        ...session.user,
        isDemo: false,
        demoExpiresAt: null,
      },
    });
    expect(resolvePrincipalMock).toHaveBeenCalledWith(session.user.id);
  });

  it("retains Demo origin on a missing principal without granting a session", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "deleted-demo",
        isDemo: true,
        demoExpiresAt: "2026-08-02T00:00:00.000Z",
      },
    });
    resolvePrincipalMock.mockResolvedValue({ status: "missing" });

    await expect(getAuthContext()).resolves.toEqual({
      status: "missing",
      sessionKind: "demo",
    });
    await expect(getSession()).resolves.toBeNull();
  });

  it("retains formal origin on a missing principal without granting a session", async () => {
    authMock.mockResolvedValue({
      user: { id: "deleted-formal", isDemo: false, demoExpiresAt: null },
    });
    resolvePrincipalMock.mockResolvedValue({ status: "missing" });

    await expect(getAuthContext()).resolves.toEqual({
      status: "missing",
      sessionKind: "formal",
    });
    await expect(getSession()).resolves.toBeNull();
  });
});

describe("auth proxy rate limiter", () => {
  it("prunes expired opaque IP windows lazily without retaining forwarding values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T00:00:00.000Z"));
    const deleteSpy = vi.spyOn(Map.prototype, "delete");

    const first = new NextRequest("https://astt.app/api/auth/session", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(await proxy(first, {} as NextFetchEvent)).toBeUndefined();

    vi.setSystemTime(new Date("2026-07-06T00:01:01.000Z"));
    const second = new NextRequest("https://astt.app/api/auth/session", {
      headers: { "x-forwarded-for": "198.51.100.2" },
    });
    expect(await proxy(second, {} as NextFetchEvent)).toBeUndefined();

    expect(deleteSpy).toHaveBeenCalled();
    expect(JSON.stringify(deleteSpy.mock.calls)).not.toContain("198.51.100.1");
    expect(JSON.stringify(deleteSpy.mock.calls)).not.toContain("198.51.100.2");

    deleteSpy.mockRestore();
    vi.useRealTimers();
  });
});
