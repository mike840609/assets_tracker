import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/lib/validators";

export async function GET() {
  const accounts = await prisma.account.findMany({
    include: { holdings: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(accounts);
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  await prisma.account.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: parsed.data,
  });
  return NextResponse.json(account, { status: 201 });
}
