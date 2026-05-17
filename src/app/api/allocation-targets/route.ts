import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAllocationTargetSchema } from "@/lib/validators";
import { ok, validationError, failure } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { serializeAllocationTarget } from "@/lib/types";

function invalidateCaches(userId: string) {
  revalidateTag(`allocation-targets:${userId}`, "max");
}

export const GET = withAuth(async (_req, _ctx, userId) => {
  const targets = await prisma.allocationTarget.findMany({
    where: { userId },
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });
  return ok(targets.map(serializeAllocationTarget));
});

export const POST = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = createAllocationTargetSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // Enforce max 20 targets per user
  const count = await prisma.allocationTarget.count({ where: { userId } });
  if (count >= 20) return failure("Maximum of 20 allocation targets allowed", 400);

  const existing = await prisma.allocationTarget.findUnique({
    where: { userId_scope_key: { userId, scope: parsed.data.scope, key: parsed.data.key } },
  });
  if (existing) return failure("A target for this scope/key already exists", 409);

  const target = await prisma.allocationTarget.create({
    data: { ...parsed.data, userId },
  });
  invalidateCaches(userId);
  return ok(serializeAllocationTarget(target), { status: 201 });
});
