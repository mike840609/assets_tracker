import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createCashTransactionSchema } from "@/lib/validators";
import { calculateBalanceDelta } from "@/lib/services/balance";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

type IdCtx = { params: Promise<{ id: string }> };

export const POST = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = createCashTransactionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { type, amount, note } = parsed.data;

  // Verify the account belongs to the authenticated user (R5 ownership check)
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

  // Invalidate user caches after mutation
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag(`accounts:${userId}`, "max");
  revalidateTag(`net-worth:${userId}`, "max");

  return ok(transaction, { status: 201 });
});
