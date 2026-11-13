import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { customPrismaAdapter } from "@/lib/auth-adapter";
import { authenticateDemoTicket } from "@/lib/demo/demo-service";
import { prisma } from "@/lib/prisma";
import {
  AUTH_SELF_HOST_PASSWORD,
  isPreviewAuthEnabled,
  isPublicDemoEnabled,
  isSelfHostAuthEnabled,
  previewAuthRequiresPassword,
  PREVIEW_AUTH_PASSWORD,
} from "@/lib/env";
import { getClientIp } from "@/lib/client-ip";
import { rateLimitSubjectCheckWithPrune } from "@/lib/rate-limit";

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

// Per-IP throttle on password attempts. It lives in authorize so it covers every
// entry point — the /login server action and a direct POST to
// /api/auth/callback/<provider> alike. In-memory per instance (see rate-limit.ts).
// ponytail: counts every password attempt, not only failures; 10 per 15 min is
// ample for a single owner. Behind a proxy without forwarding headers all clients
// share the "unknown" key, which then acts as a global throttle.
const PASSWORD_ATTEMPT_LIMIT = { limit: 10, windowMs: 15 * 60_000 };

function throttlePasswordAttempt(provider: string, password: unknown, request: Request) {
  // No password = the passwordless dev/E2E Internal Test Login; nothing to guess.
  if (!password) return;
  if (
    rateLimitSubjectCheckWithPrune(
      getClientIp(request),
      `login/${provider}`,
      PASSWORD_ATTEMPT_LIMIT,
    )
  ) {
    throw new TooManySignInAttempts();
  }
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
              throttlePasswordAttempt("self-host", credentials?.password, request);
              if (!passwordsMatch(credentials?.password, AUTH_SELF_HOST_PASSWORD)) return null;

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
              throttlePasswordAttempt("credentials", credentials?.password, request);
              if (previewAuthRequiresPassword) {
                if (!passwordsMatch(credentials?.password, PREVIEW_AUTH_PASSWORD)) return null;
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
