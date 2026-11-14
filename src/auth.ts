import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { customPrismaAdapter } from "@/lib/auth-adapter";
import { authenticateDemoTicket } from "@/lib/demo/demo-service";
import { prisma } from "@/lib/prisma";
import {
  AUTH_GLOBAL_FAILURE_LIMIT,
  AUTH_SELF_HOST_PASSWORD,
  isPreviewAuthEnabled,
  isPublicDemoEnabled,
  isSelfHostAuthEnabled,
  previewAuthRequiresPassword,
  PREVIEW_AUTH_PASSWORD,
} from "@/lib/env";
import { getClientIp } from "@/lib/client-ip";
import { isSubjectRateLimited, recordSubjectHit } from "@/lib/rate-limit";

function passwordsMatch(candidate: unknown, expected: string | undefined): boolean {
  if (typeof candidate !== "string" || !expected) return false;

  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

/** Surfaces as `?error=CredentialsSignin&code=rate_limited` and on `error.code`. */
export class TooManySignInAttempts extends CredentialsSignin {
  code = "rate_limited";
}

// Password-attempt throttle. It lives in authorize so it covers every entry point —
// the /login server action and a direct POST to /api/auth/callback/<provider>.
// Only failures count, but the limit is checked before the compare, so the right
// password is refused while blocked. In-memory per instance (see rate-limit.ts).
//
// Two buckets, because the client IP comes from X-Forwarded-For, which a client
// talking to the app directly (the default Docker port mapping) can forge:
// - per IP: the normal case behind a proxy that overwrites the header.
// - global per provider (AUTH_GLOBAL_FAILURE_LIMIT, default 100; 0 disables):
//   bounds guessing however the header is spoofed. Its cost: anyone can keep new
//   sign-ins blocked for as long as they keep sending ~100 failures per window
//   (~7/min). Existing sessions keep working. Deployments behind a correct proxy
//   can set it to 0.
const PER_IP_FAILURES = { limit: 10, windowMs: 15 * 60_000 };
const GLOBAL_FAILURES = { limit: AUTH_GLOBAL_FAILURE_LIMIT, windowMs: 15 * 60_000 };

function checkPassword(
  provider: string,
  password: unknown,
  expected: string | undefined,
  request: Request,
): boolean {
  const ip = getClientIp(request);
  if (
    isSubjectRateLimited(ip, `login/${provider}`, PER_IP_FAILURES) ||
    (GLOBAL_FAILURES.limit > 0 &&
      isSubjectRateLimited("all", `login-global/${provider}`, GLOBAL_FAILURES))
  ) {
    throw new TooManySignInAttempts();
  }
  if (passwordsMatch(password, expected)) return true;
  recordSubjectHit(ip, `login/${provider}`, PER_IP_FAILURES);
  if (GLOBAL_FAILURES.limit > 0) {
    recordSubjectHit("all", `login-global/${provider}`, GLOBAL_FAILURES);
  }
  return false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: customPrismaAdapter as NextAuthConfig["adapter"],
  providers: [
    ...authConfig.providers,
    ...(isSelfHostAuthEnabled
      ? [
          Credentials({
            id: "self-host",
            name: "Self-host",
            credentials: {
              password: { label: "Password", type: "password" },
            },
            authorize: async (credentials, request) => {
              if (
                !checkPassword("self-host", credentials?.password, AUTH_SELF_HOST_PASSWORD, request)
              ) {
                return null;
              }

              const user = await prisma.user.upsert({
                where: { email: "owner@self-host.local" },
                update: {},
                create: {
                  email: "owner@self-host.local",
                  name: "Self-host Owner",
                  appSettings: {
                    create: {
                      locale: "en-US",
                      baseCurrency: "USD",
                    },
                  },
                },
              });
              return { id: user.id, name: user.name, email: user.email, image: user.image };
            },
          }),
        ]
      : []),
    ...(isPreviewAuthEnabled
      ? [
          Credentials({
            credentials: {
              password: { label: "Password", type: "password" },
            },
            authorize: async (credentials, request) => {
              // The passwordless dev/E2E Internal Test Login has nothing to guess.
              if (previewAuthRequiresPassword) {
                if (
                  !checkPassword(
                    "credentials",
                    credentials?.password,
                    PREVIEW_AUTH_PASSWORD,
                    request,
                  )
                ) {
                  return null;
                }
              }
              const E2E_TEST_EMAIL = "e2e-test@preview.local";
              const user = await prisma.user.upsert({
                where: { email: E2E_TEST_EMAIL },
                update: {},
                create: {
                  email: E2E_TEST_EMAIL,
                  name: "E2E Test User",
                  appSettings: {
                    create: {
                      locale: "en-US",
                      baseCurrency: "USD",
                    },
                  },
                },
              });
              if (!user) return null;
              return { id: user.id, name: user.name, email: user.email, image: user.image };
            },
          }),
        ]
      : []),
    ...(isPublicDemoEnabled
      ? [
          Credentials({
            id: "public-demo",
            name: "Public Demo",
            credentials: {
              ticket: { label: "Ticket", type: "text" },
              visitorToken: { label: "Visitor token", type: "password" },
            },
            authorize: async (credentials) => {
              if (typeof credentials?.ticket !== "string") return null;
              if (typeof credentials?.visitorToken !== "string") return null;
              return authenticateDemoTicket({
                ticket: credentials.ticket,
                visitorToken: credentials.visitorToken,
                now: new Date(),
              });
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
});
