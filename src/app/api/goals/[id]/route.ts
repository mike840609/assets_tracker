import { prisma } from "@/lib/prisma";
import { updateGoalSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { invalidateGoalData } from "@/lib/cache-invalidation";

type IdCtx = { params: Promise<{ id: string }> };

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
  invalidateGoalData(userId);
  return ok(goal);
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const existing = await prisma.goal.findUnique({ where: { id, userId } });
  if (!existing) return failure("Not found", 404);

  await prisma.goal.delete({ where: { id, userId } });
  invalidateGoalData(userId);
  return ok({ ok: true });
});
