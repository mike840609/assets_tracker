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

class StaleAccountError extends Error {}

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
  // A manual balance edit logs the difference as an EDIT cash transaction. The
  // diff must be measured against the balance we actually write over, so the
  // write is guarded on that prior balance: if a concurrent cash mutation moved
  // it between our read and the commit, we reject with 409 rather than letting
  // the EDIT row desync from the stored cashBalance.
  const nextBalance = accountData.cashBalance;
  const balanceChanging =
    nextBalance !== undefined && !new Decimal(nextBalance).equals(existingAccount.cashBalance);

  let account;
  try {
    account = await prisma.$transaction(async (tx) => {
      if (!balanceChanging) {
        return tx.account.update({
          where: { id, userId },
          data: accountData,
        });
      }

      const diff = new Decimal(nextBalance!).minus(existingAccount.cashBalance);
      await tx.cashTransaction.create({
        data: {
          accountId: id,
          type: "EDIT",
          amount: diff,
          note: note || `Manual balance update (${diff.isNegative() ? "" : "+"}${diff})`,
        },
      });

      const result = await tx.account.updateMany({
        where: { id, userId, cashBalance: existingAccount.cashBalance },
        data: accountData,
      });
      if (result.count !== 1) {
        throw new StaleAccountError();
      }

      return tx.account.findUniqueOrThrow({ where: { id } });
    });
  } catch (error) {
    if (error instanceof StaleAccountError) {
      return failure("Account changed while updating; please retry", 409);
    }
    throw error;
  }

  invalidateUserCaches(userId);
  return ok(account);
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  const { id } = await params;
  // Ownership folded into the write (mirrors the holdings / recurring DELETE
  // pattern) so a missing or non-owned account returns 404 instead of throwing
  // an unhandled P2025 -> 500.
  const { count } = await prisma.account.deleteMany({ where: { id, userId } });
  if (count === 0) return failure("Not found", 404);
  invalidateUserCaches(userId);
  return ok({ ok: true });
});
