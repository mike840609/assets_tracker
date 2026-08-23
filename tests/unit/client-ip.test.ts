import { describe, expect, it } from "vitest";
import { getClientIp, getClientIpFromHeaders } from "@/lib/client-ip";

describe("getClientIpFromHeaders", () => {
  it("extracts the last non-empty IP from x-forwarded-for when present", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      "cf-connecting-ip": "203.0.113.195",
      "x-real-ip": "198.51.100.3",
    });
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.2");
  });

  it("prioritizes cf-connecting-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.195",
      "x-real-ip": "198.51.100.3",
    });
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.195");
  });

  it("extracts the last non-empty IP from x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.2");
  });

  it("returns unknown when no IP headers are present", () => {
    const headers = new Headers();
    expect(getClientIpFromHeaders(headers)).toBe("unknown");
  });

  it("extracts IP directly from a Request object via getClientIp", () => {
    const request = new Request("http://localhost/api/test", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });
});
