import { describe, expect, it } from "vitest";
import {
  getClientIp,
  getClientIpFromHeaders,
  rateLimitCheckWithPrune,
  rateLimitKeyForClientIp,
} from "@/lib/rate-limit";
import * as rateLimit from "@/lib/rate-limit";

function request(headers: HeadersInit): Request {
  return new Request("https://example.test", { headers });
}

describe("getClientIp", () => {
  it("uses the rightmost non-empty x-forwarded-for hop", () => {
    expect(
      getClientIp(
        request({
          "x-forwarded-for": "198.51.100.9, 203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("keeps single x-forwarded-for values working", () => {
    expect(getClientIp(request({ "x-forwarded-for": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("skips empty x-forwarded-for tokens before falling back", () => {
    expect(getClientIp(request({ "x-forwarded-for": " , 203.0.113.7 , " }))).toBe("203.0.113.7");
    expect(
      getClientIp(
        request({
          "x-forwarded-for": " , ",
          "cf-connecting-ip": "198.51.100.11",
          "x-real-ip": "198.51.100.12",
        }),
      ),
    ).toBe("198.51.100.11");
    expect(getClientIp(request({ "x-forwarded-for": " , " }))).toBe("unknown");
  });

  it("extracts the same trusted proxy hops directly from Server Action headers", () => {
    expect(
      getClientIpFromHeaders(
        new Headers({
          "x-forwarded-for": "198.51.100.9, 203.0.113.7",
          "cf-connecting-ip": "198.51.100.11",
          "x-real-ip": "198.51.100.12",
        }),
      ),
    ).toBe("203.0.113.7");
    expect(
      getClientIpFromHeaders(
        new Headers({
          "x-forwarded-for": " , ",
          "cf-connecting-ip": " 198.51.100.11 ",
          "x-real-ip": "198.51.100.12",
        }),
      ),
    ).toBe("198.51.100.11");
    expect(getClientIpFromHeaders(new Headers({ "x-real-ip": " 198.51.100.12 " }))).toBe(
      "198.51.100.12",
    );
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("rateLimitCheckWithPrune", () => {
  it("requires an explicit opaque key instead of falling back to a raw request identity", () => {
    const options = { limit: 1, prefix: "missing-key-test" } as unknown as Parameters<
      typeof rateLimitCheckWithPrune
    >[1];

    expect(() =>
      rateLimitCheckWithPrune(request({ "x-forwarded-for": "FORWARDED_IP_SENTINEL" }), options),
    ).toThrow("explicit key");
  });

  it("keeps a forwarding sentinel out of the module-memory limiter keys", () => {
    const rateLimitModule = rateLimit as unknown as Record<string, unknown>;
    const keyForIdentity = rateLimitModule.rateLimitKeyForIdentity as
      | ((identity: string, purpose: string) => string)
      | undefined;
    const storeKeys = rateLimitModule.__getRateLimitStoreKeysForTest as
      | (() => string[])
      | undefined;

    expect(keyForIdentity).toBeTypeOf("function");
    expect(storeKeys).toBeTypeOf("function");
    if (!keyForIdentity || !storeKeys) return;

    const rawForwardedIp = "FORWARDED_IP_SENTINEL";
    const firstKey = keyForIdentity(rawForwardedIp, "public-demo-start");
    const secondKey = keyForIdentity(rawForwardedIp, "public-demo-quote");

    expect(firstKey).not.toContain(rawForwardedIp);
    expect(secondKey).not.toContain(rawForwardedIp);
    expect(firstKey).not.toBe(secondKey);
    expect(
      rateLimitCheckWithPrune(request({ "x-forwarded-for": rawForwardedIp }), {
        limit: 1,
        prefix: "opaque-forwarded-ip-test",
        key: firstKey,
      }),
    ).toBeNull();
    expect(
      rateLimitCheckWithPrune(request({ "x-forwarded-for": "SECOND_FORWARDED_IP_SENTINEL" }), {
        limit: 1,
        prefix: "opaque-forwarded-ip-test",
        key: firstKey,
      })?.status,
    ).toBe(429);
    expect(storeKeys().join("\n")).not.toContain(rawForwardedIp);
    expect(storeKeys().join("\n")).not.toContain("SECOND_FORWARDED_IP_SENTINEL");
  });

  it("keys limits by the platform-appended x-forwarded-for hop", () => {
    const firstRequest = request({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" });
    const secondRequest = request({ "x-forwarded-for": "198.51.100.2, 203.0.113.7" });
    const options = {
      limit: 1,
      prefix: "xff-rightmost-test",
      key: rateLimitKeyForClientIp(firstRequest, "xff-rightmost-test"),
    };

    expect(rateLimitCheckWithPrune(firstRequest, options)).toBeNull();

    expect(
      rateLimitCheckWithPrune(secondRequest, {
        ...options,
        key: rateLimitKeyForClientIp(secondRequest, "xff-rightmost-test"),
      })?.status,
    ).toBe(429);
  });
});
