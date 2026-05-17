import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateAllocationTargetSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { serializeAllocationTarget } from "@/lib/types";

type IdCtx = { params: Promise<{ id: string }> };

function invalidateCaches(userId: string) {
  revalidateTag(`allocation-targets:${userId}`, "max");
}

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateAllocationTargetSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await prisma.allocationTarget.findUnique({ where: { id, userId } });
  if (!existing) return failure("Not found", 404);

  const target = await prisma.allocationTarget.update({
    where: { id, userId },
    data: parsed.data,
  });
  invalidateCaches(userId);
  return ok(serializeAllocationTarget(target));
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const existing = await prisma.allocationTarget.findUnique({ where: { id, userId } });
  if (!existing) return failure("Not found", 404);

  await prisma.allocationTarget.delete({ where: { id, userId } });
  invalidateCaches(userId);
  return ok({ ok: true });
});
