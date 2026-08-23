import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import type { AnalysisFixture } from "./analysis-fixture";

export function resolveAnalysisFixtureBaseUrl(baseUrl: string, trustedOrigin?: string): string {
  const target = new URL(baseUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Analysis fixture targets must use HTTP or HTTPS.");
  }

  const normalizedTarget = target.origin;
  const isLoopback =
    target.hostname === "localhost" ||
    target.hostname === "127.0.0.1" ||
    target.hostname === "0.0.0.0" ||
    target.hostname === "::1" ||
    target.hostname === "[::1]";
  if (!isLoopback && target.protocol !== "https:") {
    throw new Error("Remote Analysis fixture targets must use HTTPS.");
  }

  if (trustedOrigin !== undefined && new URL(trustedOrigin).origin !== normalizedTarget) {
    throw new Error("Analysis fixture target must match the configured application origin.");
  }

  if (!isLoopback && trustedOrigin === undefined) {
    throw new Error("Remote Analysis fixture targets require a configured application origin.");
  }

  return normalizedTarget;
}

function analysisFixtureBaseUrl(): string {
  const targetUrl = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
  const trustedOrigin =
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  return resolveAnalysisFixtureBaseUrl(targetUrl, trustedOrigin);
}

export async function setAnalysisFixtureLocale(
  context: BrowserContext,
  locale: string,
): Promise<void> {
  await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: analysisFixtureBaseUrl() }]);
}

export async function authenticateAnalysisFixture(
  context: BrowserContext,
  fixture: AnalysisFixture,
): Promise<void> {
  const baseUrl = analysisFixtureBaseUrl();
  const secureCookie = baseUrl.startsWith("https://");
  const cookieName = secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token";
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to authenticate the E2E fixture user.");

  const sessionToken = await encode({
    token: { sub: fixture.userId, email: fixture.email, name: "E2E Test User" },
    secret,
    salt: cookieName,
  });

  await context.addCookies([{ name: cookieName, value: sessionToken, url: baseUrl }]);
}
