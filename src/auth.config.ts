import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
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
} satisfies NextAuthConfig;
