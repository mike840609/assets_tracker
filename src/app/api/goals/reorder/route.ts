import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { reorderGoalsSchema } from "@/lib/validators";

function invalidateGoalCaches(userId: string) {
  revalidateTag("goals", { expire: 0 });
  revalidateTag(`goals:${userId}`, { expire: 0 });
}

export const PATCH = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = reorderGoalsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return failure("Duplicate goal ids are not allowed", 400);
  }

  // The payload must cover exactly the user's goals — no missing rows, no
  // foreign ids — so sortOrder stays a dense 0..n-1 sequence.
  const goals = await prisma.goal.findMany({ where: { userId }, select: { id: true } });
  if (goals.length !== orderedIds.length) {
    return failure("Reorder payload must include all goals", 400);
  }
  const ownedIds = new Set(goals.map((goal) => goal.id));
  if (!orderedIds.every((id) => ownedIds.has(id))) {
    return failure("Reorder payload does not match owned goals", 400);
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.goal.update({ where: { id, userId }, data: { sortOrder: index } }),
    ),
  );

  invalidateGoalCaches(userId);
  return ok({ ok: true });
});
