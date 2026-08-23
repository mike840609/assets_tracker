import { describe, expect, it } from "vitest";
import { resolveAnalysisFixtureBaseUrl } from "../e2e/analysis-fixture-auth";

describe("resolveAnalysisFixtureBaseUrl", () => {
  it("accepts localhost HTTP and returns its normalized origin", () => {
    // Given a local fixture target with a path
    const targetUrl = "http://localhost:3000/analysis";

    // When the fixture URL is resolved without a configured remote origin
    const resolvedUrl = resolveAnalysisFixtureBaseUrl(targetUrl);

    // Then the cookie target is the origin only
    expect(resolvedUrl).toBe("http://localhost:3000");
  });

  it("accepts 127.0.0.1 HTTP and returns its normalized origin", () => {
    // Given a loopback fixture target with a trailing slash
    const targetUrl = "http://127.0.0.1:3000/";

    // When the fixture URL is resolved without a configured remote origin
    const resolvedUrl = resolveAnalysisFixtureBaseUrl(targetUrl);

    // Then the cookie target is the origin only
    expect(resolvedUrl).toBe("http://127.0.0.1:3000");
  });

  it("accepts [::1] and 0.0.0.0 HTTP and returns normalized origins", () => {
    expect(resolveAnalysisFixtureBaseUrl("http://[::1]:3000/analysis")).toBe("http://[::1]:3000");
    expect(resolveAnalysisFixtureBaseUrl("http://0.0.0.0:3000/analysis")).toBe(
      "http://0.0.0.0:3000",
    );
  });

  it("accepts matching remote HTTPS and returns its normalized origin", () => {
    // Given a remote HTTPS target and the matching configured application origin
    const targetUrl = "https://preview.example.com/analysis?fixture=1";
    const trustedOrigin = "https://preview.example.com/";

    // When the fixture URL is resolved
    const resolvedUrl = resolveAnalysisFixtureBaseUrl(targetUrl, trustedOrigin);

    // Then the cookie target is the matching origin only
    expect(resolvedUrl).toBe("https://preview.example.com");
  });

  it("rejects remote HTTP targets", () => {
    // Given a remote plaintext target
    const targetUrl = "http://preview.example.com/analysis";

    // When the fixture URL is resolved
    const resolve = () => resolveAnalysisFixtureBaseUrl(targetUrl, targetUrl);

    // Then the fixture refuses to create cookies for it
    expect(resolve).toThrow("Remote Analysis fixture targets must use HTTPS.");
  });

  it("rejects a mismatched configured origin", () => {
    // Given a remote HTTPS target and a different configured application origin
    const targetUrl = "https://preview.example.com/analysis";
    const trustedOrigin = "https://other.example.com";

    // When the fixture URL is resolved
    const resolve = () => resolveAnalysisFixtureBaseUrl(targetUrl, trustedOrigin);

    // Then the fixture refuses to create cookies for the mismatched target
    expect(resolve).toThrow(
      "Analysis fixture target must match the configured application origin.",
    );
  });

  it("rejects an explicitly mismatched loopback origin", () => {
    // Given a loopback target and a configured origin for a different loopback host
    const targetUrl = "http://127.0.0.1:3000/analysis";
    const trustedOrigin = "http://localhost:3000";

    // When the fixture URL is resolved
    const resolve = () => resolveAnalysisFixtureBaseUrl(targetUrl, trustedOrigin);

    // Then the fixture refuses to create cookies for the mismatched target
    expect(resolve).toThrow(
      "Analysis fixture target must match the configured application origin.",
    );
  });
});
