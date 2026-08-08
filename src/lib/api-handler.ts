import "server-only";
import { after } from "next/server";
import { auth } from "@/auth";
import { failure } from "@/lib/api-responses";
import { resolvePrincipal, type AuthPrincipal } from "@/lib/auth-principal";
import { demoErrorResponse, PublicDemoError } from "@/lib/demo/demo-errors";
import { recordDemoMetric } from "@/lib/demo/demo-metrics";
import { consumeDemoMutationQuota, consumeDemoRefreshQuota } from "@/lib/demo/demo-quota-service";
import { deleteExpiredDemoUser, demoQuotaError } from "@/lib/demo/demo-service";
import { prisma } from "@/lib/prisma";
import { rateLimitCheckWithPrune, rateLimitKeyForSubject } from "@/lib/rate-limit";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type DemoAccess = "deny" | "allow" | "market-refresh";
export type DemoMarketDataAccess = "refresh-credit";
export type MarketDataRefreshCredit = () => Promise<Response | null>;

type WithAuthOptions = {
  demo?: DemoAccess;
  /**
   * Gives an otherwise-core Demo route a capability to spend a refresh credit
   * immediately before it calls a live market-data provider. This keeps the
   * capability matrix distinct from the resource budget: stock CRUD/quote
   * remain `allow`, while their provider work stays DB-authoritatively metered.
   */
  marketData?: DemoMarketDataAccess;
};

export function withAuth<Ctx = unknown>(
  handler: (
    req: Request,
    ctx: Ctx,
    userId: string,
    principal: AuthPrincipal,
    consumeMarketDataRefreshCredit?: MarketDataRefreshCredit,
  ) => Promise<Response>,
  options: WithAuthOptions = {},
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const session = await auth();
    if (!session?.user?.id) return failure("Unauthorized", 401);

    const resolution = await resolvePrincipal(session.user.id);
    if (resolution.status === "missing") return failure("Unauthorized", 401);
    if (resolution.status === "demo-disabled") {
      return demoErrorResponse(
        new PublicDemoError("DEMO_DISABLED", 503, "Public Demo is disabled"),
      );
    }
    if (resolution.status === "demo-expired") {
      after(() => deleteExpiredDemoUser(resolution.userId, new Date()));
      return demoErrorResponse(new PublicDemoError("DEMO_EXPIRED", 410, "Public Demo expired"));
    }

    const principal = resolution.principal;
    const mutation = MUTATION_METHODS.has(req.method);

    if (principal.kind === "demo") {
      const demoAccess = options.demo ?? "deny";
      if (demoAccess === "deny") {
        return demoErrorResponse(
          new PublicDemoError("DEMO_RESTRICTED", 403, "This feature requires a formal account"),
        );
      }

      if (mutation) {
        const mutationQuota = await consumeDemoMutationQuota(prisma, principal.userId, new Date(), {
          reset: false,
        });
        if (!mutationQuota.ok) {
          recordDemoMetric(
            mutationQuota.reason === "rate" || mutationQuota.reason === "conflict"
              ? "rate_limited"
              : mutationQuota.reason === "expired" || mutationQuota.reason === "missing"
                ? "expired"
                : "quota_limited",
          );
          return demoErrorResponse(demoQuotaError(mutationQuota));
        }
      }

      if (demoAccess === "market-refresh") {
        const limited = await consumeMarketDataRefreshCredit(principal);
        if (limited) return limited;
      }
    } else if (mutation) {
      const limited = rateLimitCheckWithPrune(req, {
        limit: 60,
        prefix: `mutation:${req.method}`,
        key: rateLimitKeyForSubject(principal.userId, `formal-mutation:${req.method}`),
      });
      if (limited) return limited;
    }

    const refreshCredit =
      options.marketData === "refresh-credit"
        ? () => consumeMarketDataRefreshCredit(principal)
        : undefined;
    return refreshCredit
      ? handler(req, ctx, principal.userId, principal, refreshCredit)
      : handler(req, ctx, principal.userId, principal);
  };
}

async function consumeMarketDataRefreshCredit(principal: AuthPrincipal): Promise<Response | null> {
  if (principal.kind !== "demo") return null;

  const refreshQuota = await consumeDemoRefreshQuota(prisma, principal.userId, new Date());
  if (refreshQuota.ok) return null;

  recordDemoMetric(
    refreshQuota.reason === "expired" || refreshQuota.reason === "missing"
      ? "expired"
      : "rate_limited",
  );
  return demoErrorResponse(demoQuotaError(refreshQuota));
}
