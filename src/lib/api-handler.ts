import "server-only";
import { auth } from "@/auth";
import { failure } from "@/lib/api-responses";

export function withAuth<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx, userId: string) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const session = await auth();
    if (!session?.user?.id) return failure("Unauthorized", 401);
    return handler(req, ctx, session.user.id);
  };
}
