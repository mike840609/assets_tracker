import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createCashTransactionSchema } from "@/lib/validators";
import { calculateBalanceDelta } from "@/lib/services/balance";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";

export const POST = withAuth(
  async (request, { params }: { params: Promise<{ id: string }> }, userId) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = createCashTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { type, amount, note } = parsed.data;

    const account = await prisma.account.findUnique({ where: { id, userId } });
    if (!account) return failure("Account not found", 404);

    const transaction = await prisma.cashTransaction.create({
      data: { accountId: id, type, amount, note },
    });

    const delta = calculateBalanceDelta(null, { type, amount });
    await prisma.account.update({
      where: { id },
      data: { cashBalance: { increment: delta } },
    });

    revalidateTag(`accounts:${userId}`, "max");
    revalidateTag(`net-worth:${userId}`, "max");
    revalidateTag(`history:${userId}`, "max");

    return ok(transaction, { status: 201 });
  },
);
