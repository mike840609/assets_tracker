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
    }
  }
})
