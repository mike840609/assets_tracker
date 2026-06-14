import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AUTH_SOURCE_HEADER, AUTH_SOURCE_PROXY, AUTH_USER_ID_HEADER } from "@/lib/auth-headers";
import { getAuthUser, userExists } from "@/lib/auth-user";

type AppSession = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
} | null;

async function getTrustedProxyUserId(): Promise<string | null> {
  const requestHeaders = await headers();
  if (requestHeaders.get(AUTH_SOURCE_HEADER) !== AUTH_SOURCE_PROXY) return null;
  const userId = requestHeaders.get(AUTH_USER_ID_HEADER);
  return userId && userId.trim() ? userId : null;
}

/**
 * Cached session wrapper. Proxy validates the JWT once and forwards only a
 * server-written user id header; normal page renders can then skip a second
 * JWT decode while still confirming the user exists in the database.
 */
export const getSession = cache(async (): Promise<AppSession> => {
  const proxyUserId = await getTrustedProxyUserId();
  if (proxyUserId) {
    const user = await getAuthUser(proxyUserId);
    return user ? { user } : null;
  }

  const session = await auth();
  if (!session?.user?.id) return session;

  const exists = await userExists(session.user.id);
  return exists ? session : null;
});
