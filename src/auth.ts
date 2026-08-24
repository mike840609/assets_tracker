import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
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

function passwordsMatch(candidate: unknown, expected: string | undefined): boolean {
  if (typeof candidate !== "string" || !expected) return false;

  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
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
            authorize: async (credentials) => {
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
            authorize: async (credentials) => {
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
