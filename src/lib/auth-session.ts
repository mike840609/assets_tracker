import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { userExists } from "@/lib/auth-user";

/**
 * Cached auth() wrapper — deduplicates the auth call within a single
 * React server render. The middleware already calls auth() once; this
 * ensures the page-level call reuses the same result instead of
 * decoding the JWT a second time.
 */
export const getSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return session;

  const exists = await userExists(session.user.id);
  return exists ? session : null;
});
