import NextAuth, { type NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import authConfig from "./auth.config"
import { customPrismaAdapter } from "@/lib/auth-adapter"
import { prisma } from "@/lib/prisma"
import { PREVIEW_AUTH_DISABLED, PREVIEW_AUTH_PASSWORD, VERCEL_ENV } from "@/lib/env"

const previewAuthDisabled = ["1", "true", "yes", "on"].includes((PREVIEW_AUTH_DISABLED ?? "").toLowerCase())
const isPreviewOrLocal = VERCEL_ENV === "preview" || VERCEL_ENV === "development" || !VERCEL_ENV

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: customPrismaAdapter as NextAuthConfig["adapter"],
  providers: [
    ...authConfig.providers,
    ...(isPreviewOrLocal ? [Credentials({
      credentials: {
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!isPreviewOrLocal) return null
        if (!previewAuthDisabled) {
          const expected = PREVIEW_AUTH_PASSWORD
          if (!expected || credentials?.password !== expected) return null
        }
        const E2E_TEST_EMAIL = "e2e-test@preview.local"
        const user = await prisma.user.upsert({
          where: { email: E2E_TEST_EMAIL },
          update: {},
          create: { email: E2E_TEST_EMAIL, name: "E2E Test User" },
        })
        if (!user) return null
        return { id: user.id, name: user.name, email: user.email, image: user.image }
      },
    })] : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
