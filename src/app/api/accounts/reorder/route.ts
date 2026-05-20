import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { reorderAccountsSchema } from "@/lib/validators";

function invalidateUserCaches(userId: string) {
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag(`accounts:${userId}`, "max");
  revalidateTag(`net-worth:${userId}`, "max");
  revalidateTag(`history:${userId}`, "max");
}

export const PATCH = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = reorderAccountsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { type, pinnedIds, unpinnedIds } = parsed.data;
  const combinedIds = [...pinnedIds, ...unpinnedIds];
  const uniqueCount = new Set(combinedIds).size;
  if (uniqueCount !== combinedIds.length) {
    return failure("Duplicate account ids are not allowed", 400);
  }

  const activeAccounts = await prisma.account.findMany({
    where: { userId, type, isActive: true },
    select: { id: true },
  });
  const activeIds = activeAccounts.map((a) => a.id).sort();
  const requestedIds = [...combinedIds].sort();

  if (activeIds.length !== requestedIds.length) {
    return failure("Reorder payload must include all active accounts of that type", 400);
  }
  for (let i = 0; i < activeIds.length; i += 1) {
    if (activeIds[i] !== requestedIds[i]) {
      return failure("Reorder payload does not match owned active accounts", 400);
    }
  }

  const updates = combinedIds.map((id, index) =>
    prisma.account.update({
      where: { id, userId },
      data: {
        isPinned: pinnedIds.includes(id),
        sortOrder: index,
      },
    }),
  );
  await prisma.$transaction(updates);

  invalidateUserCaches(userId);
  return ok({ ok: true });
});
