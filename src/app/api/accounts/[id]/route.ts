import { revalidateTag } from "next/cache";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "@/lib/prisma";
import { updateAccountSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

type IdCtx = { params: Promise<{ id: string }> };

function invalidateUserCaches(userId: string) {
  revalidateTag(`accounts:${userId}`, { expire: 0 });
  revalidateTag(`net-worth:${userId}`, { expire: 0 });
  revalidateTag(`history:${userId}`, { expire: 0 });
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

  const { note, ...accountData } = parsed.data;
  const account = await prisma.$transaction(async (tx) => {
    // If cashBalance is being updated to a new value, log it as an EDIT transaction.
    if (accountData.cashBalance !== undefined) {
      const diff = new Decimal(accountData.cashBalance).minus(existingAccount.cashBalance);
      if (!diff.isZero()) {
        await tx.cashTransaction.create({
          data: {
            accountId: id,
            type: "EDIT",
            amount: diff,
            note: note || `Manual balance update (${diff.isNegative() ? "" : "+"}${diff})`,
          },
        });
      }
    }

    return tx.account.update({
      where: { id, userId },
      data: accountData,
    });
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
