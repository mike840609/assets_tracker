import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig, Session } from "next-auth";
import {
  AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET,
  AUTH_REDIRECT_PROXY_URL,
  isGoogleAuthEnabled,
} from "@/lib/env";

export default {
  trustHost: true,
  redirectProxyUrl: AUTH_REDIRECT_PROXY_URL,
  providers: isGoogleAuthEnabled
    ? [
        GoogleProvider({
          clientId: AUTH_GOOGLE_ID!,
          clientSecret: AUTH_GOOGLE_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.isDemo = user.isDemo === true;
        token.demoExpiresAt = user.isDemo ? user.demoExpiresAt : undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (!token.sub) throw new Error("auth: JWT token missing 'sub' claim");
      const sessionUser = session.user as Session["user"];
      sessionUser.id = token.sub;
      sessionUser.isDemo = token.isDemo === true;
      sessionUser.demoExpiresAt =
        token.isDemo && typeof token.demoExpiresAt === "string" ? token.demoExpiresAt : null;
      return session;
    },
  },
} satisfies NextAuthConfig;
