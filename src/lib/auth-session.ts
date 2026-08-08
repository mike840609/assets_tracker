import "server-only";
import { cache } from "react";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { resolvePrincipal, type AuthPrincipal } from "@/lib/auth-principal";

export type AuthContext =
  | { status: "anonymous" }
  | { status: "missing"; sessionKind: "demo" | "formal" }
  | { status: "demo-expired"; userId: string }
  | { status: "demo-disabled"; userId: string }
  | { status: "active"; session: Session; principal: AuthPrincipal };

type DemoAwareSession = Session & {
  user: NonNullable<Session["user"]> & {
    id: string;
    isDemo: boolean;
    demoExpiresAt: string | null;
  };
};

/**
 * Cached session wrapper. Identity always comes from the signed session cookie
 * via `auth()` — never from a request header, which a client can forge whenever
 * the middleware does not run (see #639). React `cache()` keeps this to one JWT
 * decode per request across all call sites, and the database check makes sure a
 * stale cookie cannot render a signed-in shell.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const session = await auth();
  if (!session?.user?.id) return { status: "anonymous" };

  const resolution = await resolvePrincipal(session.user.id);
  if (resolution.status === "missing") {
    return {
      status: "missing",
      // This signed-session claim is a cleanup hint only. A missing principal
      // remains unauthorized and can never become active through this value.
      sessionKind: session.user.isDemo === true ? "demo" : "formal",
    };
  }
  if (resolution.status !== "active") return resolution;

  const demoAwareSession = session as DemoAwareSession;
  demoAwareSession.user.isDemo = resolution.principal.kind === "demo";
  demoAwareSession.user.demoExpiresAt =
    resolution.principal.kind === "demo" ? resolution.principal.expiresAt.toISOString() : null;

  return {
    status: "active",
    session: demoAwareSession,
    principal: resolution.principal,
  };
});

export const getSession = cache(async () => {
  const context = await getAuthContext();
  return context.status === "active" ? context.session : null;
});
