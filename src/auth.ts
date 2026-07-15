import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { customPrismaAdapter } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import {
  AUTH_SELF_HOST_PASSWORD,
  isPreviewAuthEnabled,
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
                const expected = PREVIEW_AUTH_PASSWORD;
                if (!expected || credentials?.password !== expected) return null;
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
  ],
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        if (!token.sub) {
          throw new Error("auth: JWT token missing 'sub' claim — cannot establish session user id");
        }
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
