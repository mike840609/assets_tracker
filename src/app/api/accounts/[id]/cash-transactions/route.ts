import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCashTransactionSchema } from "@/lib/validators";
import { calculateBalanceDelta } from "@/lib/services/balance";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = createCashTransactionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, amount, note } = parsed.data;

  // Verify account exists
  const account = await prisma.account.findUnique({
    where: { id },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Create the transaction
  const transaction = await prisma.cashTransaction.create({
    data: {
      accountId: id,
      type,
      amount,
      note,
    },
  });

  // Update account balance
  const delta = calculateBalanceDelta(null, { type, amount });
  await prisma.account.update({
    where: { id },
    data: { cashBalance: { increment: delta } },
  });

  return NextResponse.json(transaction, { status: 201 });
}
