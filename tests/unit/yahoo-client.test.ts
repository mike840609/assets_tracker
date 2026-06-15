import { describe, it, expect } from "vitest";

// yahoo-client imports `server-only` (aliased in vitest.config) and only
// dynamically imports yahoo-finance2 inside load(), so importing the module
// for the pure helper never pulls in the Node-only lib.
const { getYahooErrorStatus } = await import("@/lib/services/yahoo-client");

// Fabricate errors the way yahoo-finance2 shapes them (see its lib/errors.ts +
// yahooFinanceFetch.ts): BadRequestError carries only a name; HTTPError sets a
// numeric `code` to the upstream response status.
function badRequestError(message: string): Error {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
}

function httpError(message: string, code: number): Error {
  const error = new Error(message) as Error & { code: number };
  error.name = "HTTPError";
  error.code = code;
  return error;
}

describe("getYahooErrorStatus", () => {
  it("maps BadRequestError to 400", () => {
    expect(getYahooErrorStatus(badRequestError("Invalid Search Query"))).toBe(400);
  });

  it("returns the HTTPError status code (e.g. 429 rate-limit)", () => {
    expect(getYahooErrorStatus(httpError("Edge: Too Many Requests", 429))).toBe(429);
  });

  it("returns the HTTPError status code for upstream 5xx", () => {
    expect(getYahooErrorStatus(httpError("Service Unavailable", 503))).toBe(503);
  });

  it("returns undefined for a network/timeout error with no status", () => {
    expect(getYahooErrorStatus(new Error("fetch failed"))).toBeUndefined();
  });

  it("returns undefined for non-Error values", () => {
    expect(getYahooErrorStatus("boom")).toBeUndefined();
    expect(getYahooErrorStatus(undefined)).toBeUndefined();
  });
});
