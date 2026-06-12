import "server-only";
import { auth } from "@/auth";
import { failure } from "@/lib/api-responses";
import { userExists } from "@/lib/auth-user";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function withAuth<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx, userId: string) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const session = await auth();
    if (!session?.user?.id) return failure("Unauthorized", 401);
    if (!(await userExists(session.user.id))) return failure("Unauthorized", 401);
    if (MUTATION_METHODS.has(req.method)) {
      const limited = rateLimitCheckWithPrune(req, {
        limit: 60,
        prefix: `mutation:${req.method}`,
        key: session.user.id,
      });
      if (limited) return limited;
    }
    return handler(req, ctx, session.user.id);
  };
}
