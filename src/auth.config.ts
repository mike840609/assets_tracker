import GoogleProvider from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

export default {
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
} satisfies NextAuthConfig
