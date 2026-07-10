import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: unknown) => handler,
  }),
}));

vi.mock("../../src/auth.config", () => ({ default: {} }));

import proxy from "@/proxy";

const TUNNEL_PATH = "/a1b2c3d4";

function executeAnonymousRequest(pathname: string): Response {
  const request = new NextRequest(`https://astt.app${pathname}`);
  const response = proxy(request, {} as NextFetchEvent);

  if (!(response instanceof Response)) {
    throw new Error("Proxy did not return a response for an anonymous request");
  }

  return response;
}

afterEach(() => {
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

describe("auth proxy rate limiter", () => {
  it("prunes expired IP windows lazily", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T00:00:00.000Z"));
    const deleteSpy = vi.spyOn(Map.prototype, "delete");

    const first = new NextRequest("https://astt.app/api/auth/session", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(proxy(first, {} as NextFetchEvent)).toBeUndefined();

    vi.setSystemTime(new Date("2026-07-06T00:01:01.000Z"));
    const second = new NextRequest("https://astt.app/api/auth/session", {
      headers: { "x-forwarded-for": "198.51.100.2" },
    });
    expect(proxy(second, {} as NextFetchEvent)).toBeUndefined();

    expect(deleteSpy).toHaveBeenCalledWith("198.51.100.1");

    deleteSpy.mockRestore();
    vi.useRealTimers();
  });
});
