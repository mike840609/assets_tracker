import "server-only";
import { cache } from "react";
import { auth } from "@/auth";

/**
 * Cached auth() wrapper — deduplicates the auth call within a single
 * React server render. The middleware already calls auth() once; this
 * ensures the page-level call reuses the same result instead of
 * decoding the JWT a second time.
 */
export const getSession = cache(async () => {
  return auth();
});
