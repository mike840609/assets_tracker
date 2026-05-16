import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateGoalSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

type IdCtx = { params: Promise<{ id: string }> };

function invalidateGoalCaches(userId: string) {
  revalidateTag(`goals:${userId}`, "max");
}

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await prisma.goal.findUnique({ where: { id, userId } });
  if (!existing) return failure("Not found", 404);

  const { targetDate, ...rest } = parsed.data;
  const goal = await prisma.goal.update({
    where: { id, userId },
    data: {
      ...rest,
      ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}),
    },
  });
  invalidateGoalCaches(userId);
  return ok(goal);
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const existing = await prisma.goal.findUnique({ where: { id, userId } });
  if (!existing) return failure("Not found", 404);

  await prisma.goal.delete({ where: { id, userId } });
  invalidateGoalCaches(userId);
  return ok({ ok: true });
});
