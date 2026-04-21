import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

function invalidateUserCaches(userId: string) {
  revalidateTag(`accounts:${userId}`);
  revalidateTag(`net-worth:${userId}`);
}

export const GET = withAuth(async (_req, _ctx, userId) => {
  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(accounts);
});

export const DELETE = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return failure("ids array required");
  }

  await prisma.account.deleteMany({
    where: {
      id: { in: ids },
      userId,
    },
  });
  invalidateUserCaches(userId);
  return ok({ ok: true });
});

export const POST = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const account = await prisma.account.create({
    data: { ...parsed.data, userId },
  });
  invalidateUserCaches(userId);
  return ok(account, { status: 201 });
});
