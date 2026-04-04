import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateAccountSchema } from "@/lib/validators";
import { auth } from "@/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id, userId: session.user.id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(account);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingAccount = await prisma.account.findUnique({ where: { id, userId: session.user.id } });
  if (!existingAccount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
    where: { id, userId: session.user.id },
    data: parsed.data,
  });
  return NextResponse.json(account);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.account.delete({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
