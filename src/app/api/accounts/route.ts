import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/lib/validators";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(accounts);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  
  await prisma.account.deleteMany({ 
    where: { 
      id: { in: ids },
      userId: session.user.id 
    } 
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      ...parsed.data,
      userId: session.user.id
    },
  });
  return NextResponse.json(account, { status: 201 });
}
