import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createCashTransactionSchema } from "@/lib/validators";
import { calculateBalanceDelta, getCashTransactionAmountError } from "@/lib/services/balance";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";

export const POST = withAuth(
  async (request, { params }: { params: Promise<{ id: string }> }, userId) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = createCashTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { type, amount, note } = parsed.data;
    const amountError = getCashTransactionAmountError({ type, amount });
    if (amountError) return failure(amountError, 400);

    const account = await prisma.account.findUnique({ where: { id, userId } });
    if (!account) return failure("Account not found", 404);

    const delta = calculateBalanceDelta(null, { type, amount });
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.cashTransaction.create({
        data: { accountId: id, type, amount, note },
      });

      await tx.account.update({
        where: { id },
        data: { cashBalance: { increment: delta } },
      });

      return created;
    });

    revalidateTag(`accounts:${userId}`, { expire: 0 });
    revalidateTag(`net-worth:${userId}`, { expire: 0 });
    revalidateTag(`history:${userId}`, { expire: 0 });

    return ok(transaction, { status: 201 });
  },
);
