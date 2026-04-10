import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { customPrismaAdapter } from "@/lib/auth-adapter"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: customPrismaAdapter as any,
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`
      }

      try {
        const targetUrl = new URL(url)
        const currentBaseUrl = new URL(baseUrl)

        if (targetUrl.origin === currentBaseUrl.origin) {
          return url
        }

        const isVercelPreviewRedirect =
          targetUrl.hostname.endsWith(".vercel.app") &&
          currentBaseUrl.hostname.endsWith(".vercel.app")

        if (isVercelPreviewRedirect) {
          return url
        }
      } catch {
        return baseUrl
      }

      return baseUrl
    },
  }
})
