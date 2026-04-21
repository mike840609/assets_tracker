import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateAccountSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

type IdCtx = { params: Promise<{ id: string }> };

function invalidateUserCaches(userId: string) {
  revalidateTag(`accounts:${userId}`);
  revalidateTag(`net-worth:${userId}`);
  revalidateTag(`history:${userId}`);
}

export const GET = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id, userId },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  });
  if (!account) return failure("Not found", 404);
  return ok(account);
});

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existingAccount = await prisma.account.findUnique({ where: { id, userId } });
  if (!existingAccount) return failure("Not found", 404);

  // If cashBalance is being updated to a new value, log it as an EDIT transaction
  if (
    parsed.data.cashBalance !== undefined &&
    parsed.data.cashBalance !== Number(existingAccount.cashBalance)
  ) {
    const diff = parsed.data.cashBalance - Number(existingAccount.cashBalance);
    await prisma.cashTransaction.create({
      data: {
        accountId: id,
        type: "EDIT",
        amount: diff,
        note: body.note || `Manual balance update (${diff > 0 ? "+" : ""}${diff})`,
      },
    });
  }

  const account = await prisma.account.update({
    where: { id, userId },
    data: parsed.data,
  });
  invalidateUserCaches(userId);
  return ok(account);
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  await prisma.account.delete({ where: { id, userId } });
  invalidateUserCaches(userId);
  return ok({ ok: true });
});
