import { describe, expect, it } from "vitest";
import { getClientIp, rateLimitCheckWithPrune } from "@/lib/rate-limit";

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
});

describe("rateLimitCheckWithPrune", () => {
  it("keys limits by the platform-appended x-forwarded-for hop", () => {
    const options = { limit: 1, prefix: "xff-rightmost-test" };

    expect(
      rateLimitCheckWithPrune(request({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" }), options),
    ).toBeNull();

    expect(
      rateLimitCheckWithPrune(request({ "x-forwarded-for": "198.51.100.2, 203.0.113.7" }), options)
        ?.status,
    ).toBe(429);
  });
});
