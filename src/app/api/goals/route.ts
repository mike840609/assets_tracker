import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createGoalSchema } from "@/lib/validators";
import { ok, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

function invalidateGoalCaches(userId: string) {
  revalidateTag(`goals:${userId}`, { expire: 0 });
}

export const GET = withAuth(async (_req, _ctx, userId) => {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return ok(goals);
});

export const POST = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // Append new goals to the bottom so a manually saved order stays intact.
  const { _max } = await prisma.goal.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (_max.sortOrder ?? -1) + 1;

  const { targetDate, ...rest } = parsed.data;
  const goal = await prisma.goal.create({
    data: {
      ...rest,
      userId,
      targetDate: targetDate ? new Date(targetDate) : null,
      sortOrder: nextSortOrder,
    },
  });
  invalidateGoalCaches(userId);
  return ok(goal, { status: 201 });
});
